import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  DemoMailbox,
  DevMailbox,
  DevPush,
  DevWhatsApp,
  MetaWhatsApp,
  WebPushSender,
  DisabledTsa,
  FakePayments,
  LocalStorage,
  PostmarkEmail,
  Rfc3161Tsa,
  StripePayments,
  SupabaseStorage,
  type EmailSender,
  type ObjectStorage,
  type PaymentProvider,
  type PushSender,
  type WhatsAppSender,
} from '@pluma/adapters';
import { createDb, sql, isDemoMode, onVercel, runtimeDatabaseUrl, supabaseServiceKey, supabaseUrl, vercelUrl, type DbHandle } from '@pluma/db';
import type { Deps } from './deps';

const g = globalThis as unknown as { __plumaDb?: DbHandle; __plumaDeps?: Deps; __plumaAppUrlResolved?: boolean };

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  return v;
}

/** Producción estricta: proveedores reales obligatorios. La demo en Vercel no lo es. */
const isProd = () => process.env.NODE_ENV === 'production' && !isDemoMode();

/** En demo, los secretos se derivan de la clave de servicio de Supabase (la comparten web y admin). */
function demoSecret(name: string) {
  const base = supabaseServiceKey() ?? runtimeDatabaseUrl();
  if (!base) throw new Error(`Falta ${name}`);
  return createHash('sha256').update(`pluma-demo:${name}:${base}`).digest('base64url');
}
const devSecret = (name: string) => process.env[name] || (isDemoMode() ? demoSecret(name) : isProd() ? env(name) : `dev-only-${name.toLowerCase()}`);

/** Raíz del monorepo (para carpetas de desarrollo compartidas entre apps). */
const repoRoot = () => process.env.PLUMA_REPO_ROOT ?? resolve(/*turbopackIgnore: true*/ process.cwd(), process.cwd().includes('/apps/') ? '../..' : '.');

/** PLUMA_DATA_KEY: 32 bytes en base64. En desarrollo se deriva del secreto de firma. */
function dataKeyFromEnv(): Buffer {
  const raw = process.env.PLUMA_DATA_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('PLUMA_DATA_KEY debe ser de 32 bytes en base64');
    return key;
  }
  if (isProd()) throw new Error('Falta PLUMA_DATA_KEY');
  return createHash('sha256').update(`data-key:${devSecret('PLUMA_SIGNING_SECRET')}`).digest();
}

/** URL pública de la app del autor. En Vercel (web) se toma del despliegue; el admin la necesita en PLUMA_APP_URL. */
export function appUrlFromEnv(): string {
  return explicitAppUrl() || (process.env.PLUMA_APP_KIND !== 'admin' ? vercelUrl() : undefined) || 'http://localhost:3000';
}

/** PLUMA_APP_URL, salvo que en Vercel apunte a localhost (copiada de .env.example). */
export function explicitAppUrl(): string | undefined {
  const v = process.env.PLUMA_APP_URL?.trim();
  if (!v) return undefined;
  if (onVercel() && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(v)) return undefined;
  return v.replace(/\/+$/, '');
}

export function supabaseStorage(): SupabaseStorage {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  return new SupabaseStorage(url, key);
}

export function localStorageAdapter(): LocalStorage {
  return new LocalStorage(process.env.PLUMA_LOCAL_STORAGE_DIR ?? resolve(/*turbopackIgnore: true*/ repoRoot(), '.dev-storage'), `${appUrlFromEnv()}/api/dev-storage`, devSecret('PLUMA_SIGNING_SECRET'));
}

/**
 * Construye las dependencias a partir del entorno. En producción exige proveedores reales:
 * pagos simulados, correo a carpeta y auth de desarrollo se rechazan.
 */
export function depsFromEnv(): Deps {
  if (g.__plumaDeps) return g.__plumaDeps;
  const dbUrl = runtimeDatabaseUrl();
  if (!dbUrl) throw new Error('Falta DATABASE_URL (o POSTGRES_URL de la integración de Supabase)');
  g.__plumaDb ??= createDb(dbUrl, { max: Number(process.env.PLUMA_DB_POOL ?? (onVercel() ? 3 : 10)) });
  const appUrl = appUrlFromEnv();
  const demo = isDemoMode();
  const scratch = (name: string) => (onVercel() ? join(tmpdir(), name) : resolve(/*turbopackIgnore: true*/ repoRoot(), name));

  const paymentsKind = process.env.PLUMA_PAYMENTS ?? (isProd() ? 'stripe' : 'fake');
  if (isProd() && paymentsKind !== 'stripe') throw new Error('En producción PLUMA_PAYMENTS debe ser "stripe"');
  const payments: PaymentProvider =
    paymentsKind === 'stripe'
      ? new StripePayments(env('STRIPE_SECRET_KEY'), env('STRIPE_WEBHOOK_SECRET'), {
          [env('STRIPE_PRICE_SOCIO')]: 'socio',
          [env('STRIPE_PRICE_PRO')]: 'pro',
        })
      : new FakePayments(appUrl, devSecret('PLUMA_SIGNING_SECRET'));

  const emailKind = process.env.PLUMA_EMAIL ?? (isProd() ? 'postmark' : demo ? 'demo' : 'dev');
  if (isProd() && emailKind !== 'postmark') throw new Error('En producción PLUMA_EMAIL debe ser "postmark"');
  const mail: EmailSender =
    emailKind === 'postmark'
      ? new PostmarkEmail(env('POSTMARK_TOKEN'), env('PLUMA_EMAIL_FROM'))
      : emailKind === 'demo'
        ? new DemoMailbox(g.__plumaDb.db)
        : new DevMailbox(process.env.PLUMA_DEV_MAIL_DIR ?? resolve(/*turbopackIgnore: true*/ repoRoot(), '.dev-mail'));

  const storage: ObjectStorage =
    (process.env.PLUMA_STORAGE ?? (isProd() || (demo && onVercel()) ? 'supabase' : 'local')) === 'supabase'
      ? supabaseStorage()
      : localStorageAdapter();

  // Push: Web Push con VAPID si hay claves; si no, carpeta de desarrollo (en producción son obligatorias).
  const vapidPublic = process.env.PLUMA_VAPID_PUBLIC ?? null;
  if (isProd() && !vapidPublic) throw new Error('Falta PLUMA_VAPID_PUBLIC');
  const push: PushSender = vapidPublic
    ? new WebPushSender(vapidPublic, env('PLUMA_VAPID_PRIVATE'), env('PLUMA_VAPID_SUBJECT', 'mailto:soporte@pluma.mu'))
    : new DevPush(process.env.PLUMA_DEV_PUSH_DIR ?? scratch('.dev-push'));

  // WhatsApp: apagado salvo que se configure ("meta" o "dev").
  const waKind = process.env.PLUMA_WHATSAPP ?? 'off';
  const whatsapp: WhatsAppSender | null =
    waKind === 'meta' ? new MetaWhatsApp(env('WHATSAPP_PHONE_NUMBER_ID'), env('WHATSAPP_TOKEN')) : waKind === 'dev' ? new DevWhatsApp(scratch('.dev-whatsapp')) : null;

  g.__plumaDeps = {
    db: g.__plumaDb.db,
    mail,
    push,
    whatsapp,
    payments,
    storage,
    tsa: process.env.PLUMA_TSA_URL ? new Rfc3161Tsa(process.env.PLUMA_TSA_URL) : new DisabledTsa(),
    appUrl,
    signUrl: (onVercel() && /localhost/.test(process.env.PLUMA_SIGN_URL ?? '') ? undefined : process.env.PLUMA_SIGN_URL) || `${appUrl}/firmar`,
    signingSecret: devSecret('PLUMA_SIGNING_SECRET'),
    dataKey: dataKeyFromEnv(),
    now: () => new Date(),
  };
  return g.__plumaDeps;
}

/**
 * Demo: el admin no conoce la URL de la app del autor; la lee de pluma_demo.settings (la guarda el despliegue de la app).
 * Con PLUMA_APP_URL definida no hace nada.
 */
export async function ensureDemoAppUrl(deps: Deps) {
  if (explicitAppUrl() || !isDemoMode() || process.env.PLUMA_APP_KIND !== 'admin' || g.__plumaAppUrlResolved) return;
  try {
    const [row] = await deps.db.execute<{ value: string }>(sql`select value from pluma_demo.settings where key = 'app_url'`);
    if (row) {
      deps.appUrl = row.value;
      deps.signUrl = `${row.value}/firmar`;
      g.__plumaAppUrlResolved = true;
    }
  } catch {
    // Sin esquema de demo todavía: se reintenta en la próxima petición.
  }
}

export async function closeRuntime() {
  await g.__plumaDb?.close();
  g.__plumaDb = undefined;
  g.__plumaDeps = undefined;
}

import { resolve } from 'node:path';
import {
  DevMailbox,
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
} from '@pluma/adapters';
import { createDb, type DbHandle } from '@pluma/db';
import type { Deps } from './deps';

const g = globalThis as unknown as { __plumaDb?: DbHandle; __plumaDeps?: Deps };

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  return v;
}

const isProd = () => process.env.NODE_ENV === 'production';
const devSecret = (name: string) => (isProd() ? env(name) : (process.env[name] ?? `dev-only-${name.toLowerCase()}`));

/** Raíz del monorepo (para carpetas de desarrollo compartidas entre apps). */
const repoRoot = () => process.env.PLUMA_REPO_ROOT ?? resolve(/*turbopackIgnore: true*/ process.cwd(), process.cwd().includes('/apps/') ? '../..' : '.');

export function localStorageAdapter(): LocalStorage {
  return new LocalStorage(process.env.PLUMA_LOCAL_STORAGE_DIR ?? resolve(/*turbopackIgnore: true*/ repoRoot(), '.dev-storage'), `${env('PLUMA_APP_URL', 'http://localhost:3000')}/api/dev-storage`, devSecret('PLUMA_SIGNING_SECRET'));
}

/**
 * Construye las dependencias a partir del entorno. En producción exige proveedores reales:
 * pagos simulados, correo a carpeta y auth de desarrollo se rechazan.
 */
export function depsFromEnv(): Deps {
  if (g.__plumaDeps) return g.__plumaDeps;
  g.__plumaDb ??= createDb(env('DATABASE_URL'), { max: Number(process.env.PLUMA_DB_POOL ?? 10) });
  const appUrl = env('PLUMA_APP_URL', 'http://localhost:3000');

  const paymentsKind = process.env.PLUMA_PAYMENTS ?? (isProd() ? 'stripe' : 'fake');
  if (isProd() && paymentsKind !== 'stripe') throw new Error('En producción PLUMA_PAYMENTS debe ser "stripe"');
  const payments: PaymentProvider =
    paymentsKind === 'stripe'
      ? new StripePayments(env('STRIPE_SECRET_KEY'), env('STRIPE_WEBHOOK_SECRET'), {
          [env('STRIPE_PRICE_SOCIO')]: 'socio',
          [env('STRIPE_PRICE_PRO')]: 'pro',
        })
      : new FakePayments(appUrl, devSecret('PLUMA_SIGNING_SECRET'));

  const emailKind = process.env.PLUMA_EMAIL ?? (isProd() ? 'postmark' : 'dev');
  if (isProd() && emailKind !== 'postmark') throw new Error('En producción PLUMA_EMAIL debe ser "postmark"');
  const mail: EmailSender =
    emailKind === 'postmark' ? new PostmarkEmail(env('POSTMARK_TOKEN'), env('PLUMA_EMAIL_FROM')) : new DevMailbox(process.env.PLUMA_DEV_MAIL_DIR ?? resolve(/*turbopackIgnore: true*/ repoRoot(), '.dev-mail'));

  const storage: ObjectStorage =
    (process.env.PLUMA_STORAGE ?? (isProd() ? 'supabase' : 'local')) === 'supabase'
      ? new SupabaseStorage(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
      : localStorageAdapter();

  g.__plumaDeps = {
    db: g.__plumaDb.db,
    mail,
    payments,
    storage,
    tsa: process.env.PLUMA_TSA_URL ? new Rfc3161Tsa(process.env.PLUMA_TSA_URL) : new DisabledTsa(),
    appUrl,
    signUrl: env('PLUMA_SIGN_URL', `${appUrl}/firmar`),
    signingSecret: devSecret('PLUMA_SIGNING_SECRET'),
    now: () => new Date(),
  };
  return g.__plumaDeps;
}

export async function closeRuntime() {
  await g.__plumaDb?.close();
  g.__plumaDb = undefined;
  g.__plumaDeps = undefined;
}

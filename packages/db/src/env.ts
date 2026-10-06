/**
 * Lectura del entorno compartida por las apps, el worker y las CLI. Sin dependencias pesadas:
 * se puede importar desde el proxy de Next.
 */

/** Busca una variable por nombre exacto o con prefijo (las integraciones de Vercel permiten prefijos: STORAGE_POSTGRES_URL…). */
export function envLike(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  for (const n of names) {
    const key = Object.keys(process.env).find((k) => k.endsWith(`_${n}`) && process.env[k]);
    if (key) return process.env[key];
  }
  return undefined;
}

export const onVercel = () => process.env.VERCEL === '1';

/**
 * Modo demostración: datos ficticios, pago simulado, cuentas con contraseña y correos visibles en la app.
 * En Vercel es el modo por defecto hasta que exista la configuración real (PLUMA_MODE=production).
 */
export function isDemoMode(): boolean {
  const mode = process.env.PLUMA_MODE;
  if (mode) return mode === 'demo';
  return onVercel();
}

/**
 * Deja solo `sslmode` en la URL: postgres.js manda cualquier otro parámetro (p. ej. `supa=…` de Supabase)
 * como configuración de sesión y el servidor lo rechaza. Supabase siempre va con TLS.
 */
export function cleanDatabaseUrl(raw: string): string {
  const u = new URL(raw);
  const sslmode = u.searchParams.get('sslmode') ?? (u.hostname.endsWith('supabase.co') || u.hostname.endsWith('supabase.com') ? 'require' : null);
  u.search = '';
  if (sslmode) u.searchParams.set('sslmode', sslmode);
  return u.toString();
}

/** Conexión de la app (pooler en modo transacción en Supabase). */
export function runtimeDatabaseUrl(): string | undefined {
  const v = envLike('DATABASE_URL', 'POSTGRES_URL');
  return v ? cleanDatabaseUrl(v) : undefined;
}

/** Conexión para migraciones (sesión completa: candados y DDL). */
export function directDatabaseUrl(): string | undefined {
  const v = envLike('DATABASE_URL_DIRECT', 'POSTGRES_URL_NON_POOLING') ?? envLike('DATABASE_URL', 'POSTGRES_URL');
  return v ? cleanDatabaseUrl(v) : undefined;
}

export const supabaseUrl = () => envLike('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
export const supabaseServiceKey = () => envLike('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');

/** URL pública de este despliegue en Vercel (la de producción si existe). */
export function vercelUrl(): string | undefined {
  const host = process.env.VERCEL_ENV === 'production' ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL) : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
  return host ? `https://${host}` : undefined;
}

/** ¿La app despacha el outbox al responder? (sin worker: desarrollo y demo). */
export function inlineDispatch(): boolean {
  const v = process.env.PLUMA_INLINE_DISPATCH;
  if (v) return v === '1';
  return process.env.NODE_ENV !== 'production' || isDemoMode();
}

/** Modo de autenticación: dev (contraseña + código en la app) o supabase. */
export function authMode(): 'dev' | 'supabase' {
  const v = process.env.PLUMA_AUTH_MODE;
  if (v === 'dev' || v === 'supabase') return v;
  return process.env.NODE_ENV === 'production' && !isDemoMode() ? 'supabase' : 'dev';
}

/** Tabla de cuentas de la autenticación de desarrollo. En demo vive aparte de Supabase Auth. */
export const devAccountsTable = () => (isDemoMode() ? 'pluma_demo.accounts' : 'auth.users');

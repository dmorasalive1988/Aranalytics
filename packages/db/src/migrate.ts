import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { cleanDatabaseUrl } from './env';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface MigrateResult {
  applied: string[];
  bootstrapped: boolean;
}

/**
 * Aplica las migraciones pendientes en orden, cada una en su transacción.
 * Si la base no es Supabase (no existe el esquema `auth`), aplica antes la capa de compatibilidad local.
 * Una migración ya aplicada cuyo contenido cambió es un error: las migraciones no se editan.
 */
export async function migrate(databaseUrl: string, log: (m: string) => void = console.log): Promise<MigrateResult> {
  const sql = postgres(cleanDatabaseUrl(databaseUrl), { max: 1, onnotice: () => {} });
  try {
    // Dos despliegues a la vez (web y admin) no migran en paralelo.
    await sql`select pg_advisory_lock(728311)`;
    let bootstrapped = false;
    const [row] = await sql<{ has_auth: boolean }[]>`select to_regnamespace('auth') is not null as has_auth`;
    if (!row?.has_auth) {
      await sql.unsafe(await readFile(join(root, 'bootstrap/local-supabase-compat.sql'), 'utf8'));
      bootstrapped = true;
      log('· capa de compatibilidad local (auth, roles) aplicada');
    }

    await sql`create table if not exists _pluma_migrations (name text primary key, sha256 char(64) not null, applied_at timestamptz not null default now())`;
    const done = new Map((await sql<{ name: string; sha256: string }[]>`select name, sha256 from _pluma_migrations`).map((r) => [r.name, r.sha256]));

    const files = (await readdir(join(root, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
    const applied: string[] = [];
    for (const f of files) {
      const body = await readFile(join(root, 'migrations', f), 'utf8');
      const sha = createHash('sha256').update(body).digest('hex');
      const prev = done.get(f);
      if (prev) {
        if (prev !== sha) throw new Error(`La migración ${f} cambió después de aplicarse. Crea una migración nueva.`);
        continue;
      }
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into _pluma_migrations (name, sha256) values (${f}, ${sha})`;
      });
      applied.push(f);
      log(`✓ ${f}`);
    }
    return { applied, bootstrapped };
  } finally {
    await sql`select pg_advisory_unlock(728311)`.catch(() => {});
    await sql.end();
  }
}

/** Crea el esquema de la demo (cuentas y buzón). Idempotente. */
export async function applyDemoSchema(databaseUrl: string): Promise<void> {
  const sql = postgres(cleanDatabaseUrl(databaseUrl), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(await readFile(join(root, 'bootstrap/demo.sql'), 'utf8'));
  } finally {
    await sql.end();
  }
}

/** Borra todo (solo desarrollo y pruebas). */
export async function resetDatabase(databaseUrl: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('reset deshabilitado en producción');
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`drop schema if exists public cascade; drop schema if exists pluma_demo cascade; create schema public; grant all on schema public to public;`);
    // Cuentas de la capa local de autenticación (nunca toca Supabase Auth real, que tiene auth.identities).
    const [row] = await sql<{ local: boolean }[]>`select to_regclass('auth.users') is not null and to_regclass('auth.identities') is null as local`;
    if (row?.local) await sql`truncate auth.users`;
  } finally {
    await sql.end();
  }
}

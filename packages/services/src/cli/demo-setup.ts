/**
 * Prepara la base de la demo en cada despliegue (Vercel lo corre antes de `next build`):
 * migraciones, esquema de la demo, buckets de Supabase Storage y, si la base está vacía, los datos de ejemplo.
 * Fuera del modo demo no hace nada. Idempotente y seguro con dos despliegues a la vez.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { applyDemoSchema, devAccountsTable, directDatabaseUrl, isDemoMode, migrate, sql, vercelUrl } from '@pluma/db';
import type { SupabaseStorage } from '@pluma/adapters';
import * as S from '../index';
import { SAMPLE_PASSWORD, ensureDemoHistory, seedSampleData } from '../sample-data';

const rootEnv = resolve(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

if (!isDemoMode()) {
  console.log('[demo] PLUMA_MODE no es "demo": no se prepara nada.');
  process.exit(0);
}
const direct = directDatabaseUrl();
if (!direct) {
  console.error('[demo] Falta la base de datos: conecta Supabase al proyecto en Vercel (Storage → Supabase) o define DATABASE_URL.');
  process.exit(1);
}

const r = await migrate(direct, (m) => console.log(`[demo] ${m}`));
console.log(`[demo] migraciones: ${r.applied.length ? r.applied.join(', ') : 'al día'}`);
await applyDemoSchema(direct);

const deps = S.depsFromEnv();
if (process.env.PLUMA_APP_KIND !== 'admin') {
  const url = S.explicitAppUrl() || vercelUrl();
  if (url) {
    await deps.db.execute(sql`insert into pluma_demo.settings (key, value) values ('app_url', ${url}) on conflict (key) do update set value = excluded.value`);
    console.log(`[demo] app del autor: ${url}`);
  }
}
if ('ensureBuckets' in deps.storage) {
  await (deps.storage as SupabaseStorage).ensureBuckets();
  console.log('[demo] buckets de almacenamiento listos');
}

// Un solo despliegue carga los datos de ejemplo (el otro espera y ve que ya existen).
const lock = postgres(direct, { max: 1, onnotice: () => {} });
try {
  await lock`select pg_advisory_lock(728312)`;
  const seeded = await seedSampleData(deps, { accountsTable: devAccountsTable(), fixturesDir: resolve(import.meta.dirname, '../../../../fixtures/statements'), log: (m) => console.log(`[demo] ${m}`) });
  console.log(seeded ? `[demo] datos de ejemplo cargados (contraseña: ${SAMPLE_PASSWORD})` : '[demo] la base ya tenía datos: no se tocan');
  if (!seeded) {
    const added = await ensureDemoHistory(deps, resolve(import.meta.dirname, '../../../../fixtures/statements'));
    if (added) console.log(`[demo] ${added} períodos de historia agregados para la analítica`);
  }
} finally {
  await lock`select pg_advisory_unlock(728312)`.catch(() => {});
  await lock.end();
}
await S.closeRuntime();

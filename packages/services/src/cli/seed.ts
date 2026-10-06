/**
 * Datos de ejemplo (desarrollo): pnpm db:seed. Contraseña de todas las cuentas: pluma-dev-2026
 * Con PLUMA_MODE=demo las cuentas van a pluma_demo.accounts; si no, a la capa local auth.users.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { devAccountsTable, isDemoMode, sql } from '@pluma/db';
import * as S from '../index';
import { SAMPLE_PASSWORD, ensureDemoHistory, seedSampleData } from '../sample-data';

const rootEnv = resolve(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
process.env.PLUMA_REPO_ROOT ??= resolve(import.meta.dirname, '../../../..');

const deps = S.depsFromEnv();
if (process.env.NODE_ENV === 'production' && !isDemoMode()) throw new Error('El seed no corre en producción');
const table = devAccountsTable();
if (table === 'auth.users') {
  // Las cuentas se crean directo en auth.users: solo vale con la capa local (sin Supabase Auth).
  const [{ supabase }] = (await deps.db.execute<{ supabase: boolean }>(sql`select to_regclass('auth.identities') is not null as supabase`)) as unknown as [{ supabase: boolean }];
  if (supabase) throw new Error('Con Supabase Auth, crea las cuentas desde la app (o usa PLUMA_MODE=demo).');
}
const done = await seedSampleData(deps, { accountsTable: table, fixturesDir: resolve(import.meta.dirname, '../../../../fixtures/statements') });
console.log(done ? `
Listo. Contraseña de todas las cuentas: ${SAMPLE_PASSWORD}
  Autores:   valentina@pluma.test (es, Pro) · diego@pluma.test (es, Socio) · sam@pluma.test (en, Pro) · camila@pluma.test (pt-BR, Socio)
  Back-office: operaciones@pluma.test (operador) · aprobaciones@pluma.test (aprobador) · admin@pluma.test (super admin)
  Pluma Sync: compras@agenciafaro.test (comprador) · Portal A&R: ar@selloandino.test` : 'La base ya tiene usuarios; para empezar de cero: pnpm db:reset && pnpm db:seed');
if (!done) {
  const added = await ensureDemoHistory(deps, resolve(import.meta.dirname, '../../../../fixtures/statements'));
  if (added) console.log(`Se agregaron ${added} períodos de historia para la analítica.`);
}
await S.closeRuntime();

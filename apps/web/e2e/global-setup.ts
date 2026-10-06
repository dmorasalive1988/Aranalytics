import { rmSync } from 'node:fs';
import postgres from 'postgres';
import { migrate, resetDatabase } from '@pluma/db';
import { E2E_DB, MAIL_DIR, PORT } from '../playwright.config';

export default async function setup() {
  const u = new URL(E2E_DB);
  const name = u.pathname.slice(1);
  u.pathname = '/postgres';
  const admin = postgres(u.toString(), { max: 1, onnotice: () => {} });
  if (!(await admin`select 1 from pg_database where datname = ${name}`).length) await admin.unsafe(`create database "${name}"`);
  await admin.end();
  await resetDatabase(E2E_DB);
  await migrate(E2E_DB, () => {});
  rmSync(MAIL_DIR, { recursive: true, force: true });
  await warmUp();
}

/**
 * El servidor de desarrollo compila cada página la primera vez que se pide. Se piden antes las del
 * primer recorrido (con reintentos) para que ninguna prueba cargue con una compilación en frío.
 */
async function warmUp() {
  const base = `http://localhost:${PORT}`;
  for (const path of ['/bienvenida', '/registro', '/verificar', '/entrar', '/es']) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const r = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(120_000) });
        if (r.status < 500) break;
      } catch {
        // reintenta: la primera compilación puede cortar la conexión
      }
      await new Promise((ok) => setTimeout(ok, 2_000));
    }
  }
}

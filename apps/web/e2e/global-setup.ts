import { rmSync } from 'node:fs';
import postgres from 'postgres';
import { migrate, resetDatabase } from '@pluma/db';
import { E2E_DB, MAIL_DIR } from '../playwright.config';

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
}

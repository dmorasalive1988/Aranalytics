import postgres from 'postgres';
import { migrate, resetDatabase } from '@pluma/db';

export const TEST_URL = process.env.SERVICES_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pluma_test_services';

export default async function setup() {
  const u = new URL(TEST_URL);
  const name = u.pathname.slice(1);
  u.pathname = '/postgres';
  const admin = postgres(u.toString(), { max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists.length) await admin.unsafe(`create database "${name}"`);
  await admin.end();
  await resetDatabase(TEST_URL);
  await migrate(TEST_URL, () => {});
}

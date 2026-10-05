import { migrate, resetDatabase } from '../src/migrate';

export const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pluma_test';

export default async function setup() {
  await resetDatabase(TEST_URL);
  await migrate(TEST_URL, () => {});
}

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

export const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pluma_test';
export const PUBLISHER = '00000000-0000-4000-8000-000000000001';

export async function makeWriter(sql: postgres.Sql, opts: { plan?: 'socio' | 'pro' } = {}) {
  const id = randomUUID();
  await sql`insert into users (id, email) values (${id}, ${`w-${id.slice(0, 8)}@test.pluma`})`;
  await sql`insert into writer_profiles (user_id, publisher_id, legal_name, artist_name, country, birth_date)
            values (${id}, ${PUBLISHER}, 'Autor de prueba', 'Prueba', 'CO', '1990-01-01')`;
  if (opts.plan) {
    await sql`insert into memberships (user_id, plan_code, status, current_period_start, current_period_end)
              values (${id}, ${opts.plan}, 'active', now(), now() + interval '1 year')`;
  }
  return id;
}

export async function makeWork(sql: postgres.Sql, ownerId: string, title = 'Obra de prueba') {
  const [w] = await sql<{ id: string }[]>`insert into works (publisher_id, title, language, genre, ai_declaration, created_by)
    values (${PUBLISHER}, ${title}, 'es', 'pop', 'none', ${ownerId}) returning id`;
  return w!.id;
}

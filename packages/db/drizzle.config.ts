import { defineConfig } from 'drizzle-kit';

// El esquema TypeScript se GENERA desde la base migrada (las migraciones SQL son la fuente de verdad):
//   DATABASE_URL=... pnpm --filter @pluma/db introspect
export default defineConfig({
  dialect: 'postgresql',
  out: './drizzle',
  schemaFilter: ['public'],
  tablesFilter: ['!_pluma_migrations'],
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pluma_test' },
});

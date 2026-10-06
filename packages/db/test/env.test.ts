import { afterEach, describe, expect, it } from 'vitest';
import { authMode, cleanDatabaseUrl, devAccountsTable, directDatabaseUrl, inlineDispatch, isDemoMode, runtimeDatabaseUrl } from '../src/env';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
const set = (vars: Record<string, string | undefined>) => {
  for (const k of ['PLUMA_MODE', 'VERCEL', 'NODE_ENV', 'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL_DIRECT', 'PLUMA_AUTH_MODE', 'PLUMA_INLINE_DISPATCH']) delete process.env[k];
  Object.assign(process.env, vars);
};

describe('entorno de despliegue', () => {
  it('limpia la URL de Supabase: solo queda sslmode (postgres.js rechazaría supa=…)', () => {
    expect(cleanDatabaseUrl('postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x')).toBe('postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require');
    expect(cleanDatabaseUrl('postgres://u:p@db.abc.supabase.co:5432/postgres')).toContain('sslmode=require');
    expect(cleanDatabaseUrl('postgres://postgres:postgres@localhost:5432/pluma')).toBe('postgres://postgres:postgres@localhost:5432/pluma');
  });

  it('toma las variables de la integración de Vercel, también con prefijo', () => {
    set({ STORAGE_POSTGRES_URL: 'postgres://a@h:6543/db?supa=x', STORAGE_POSTGRES_URL_NON_POOLING: 'postgres://a@h:5432/db' });
    expect(runtimeDatabaseUrl()).toBe('postgres://a@h:6543/db');
    expect(directDatabaseUrl()).toBe('postgres://a@h:5432/db');
    delete process.env.STORAGE_POSTGRES_URL;
    delete process.env.STORAGE_POSTGRES_URL_NON_POOLING;
  });

  it('en Vercel es demo salvo PLUMA_MODE=production; producción estricta exige Supabase Auth', () => {
    set({ VERCEL: '1', NODE_ENV: 'production' });
    expect([isDemoMode(), authMode(), inlineDispatch(), devAccountsTable()]).toEqual([true, 'dev', true, 'pluma_demo.accounts']);
    set({ VERCEL: '1', NODE_ENV: 'production', PLUMA_MODE: 'production' });
    expect([isDemoMode(), authMode(), inlineDispatch()]).toEqual([false, 'supabase', false]);
    set({ NODE_ENV: 'development' });
    expect([isDemoMode(), authMode(), devAccountsTable()]).toEqual([false, 'dev', 'auth.users']);
  });
});

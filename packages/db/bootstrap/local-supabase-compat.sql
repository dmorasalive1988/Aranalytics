-- =============================================================================
-- Compatibilidad local con Supabase (SOLO cuando la base no es Supabase).
-- Crea los roles, el esquema `auth` y las funciones que Supabase ya trae, para poder
-- correr migraciones, RLS y pruebas sobre cualquier PostgreSQL 16 sin Docker.
-- El runner solo aplica este archivo si no existe el esquema `auth`.
-- =============================================================================
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

grant anon, authenticated, service_role to current_user;

create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Tabla mínima equivalente a auth.users de Supabase (la usa el proveedor de auth "dev").
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  raw_user_meta_data  jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

do $$ begin
  execute format('alter database %I set search_path = public, extensions', current_database());
end $$;

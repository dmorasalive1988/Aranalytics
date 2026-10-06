-- Pluma · esquema de la demostración (solo con PLUMA_MODE=demo). Fuera de `public`: la API de Supabase no lo expone.
create schema if not exists pluma_demo;
revoke all on schema pluma_demo from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema pluma_demo from anon, authenticated'; end if;
end $$;

-- Cuentas de la demo (contraseña + código mostrado en la app). No toca Supabase Auth.
create table if not exists pluma_demo.accounts (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  raw_user_meta_data  jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

-- Buzón: los correos que en producción saldrían por el proveedor.
create table if not exists pluma_demo.mail (
  id          bigserial primary key,
  recipient   text not null,
  subject     text not null,
  html        text not null,
  body_text   text not null,
  tag         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists mail_recipient on pluma_demo.mail (recipient, created_at desc);

-- Ajustes compartidos entre los despliegues (p. ej. la URL de la app del autor, que el admin usa en los correos).
create table if not exists pluma_demo.settings (
  key    text primary key,
  value  text not null
);

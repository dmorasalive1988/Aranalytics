-- Pluma · 0010 · Contactos del sitio público: lista de espera, compradores de sync y A&Rs
set search_path = public, extensions;

create type lead_kind as enum ('waitlist', 'sync', 'ar');

create table marketing_leads (
  id         uuid primary key default gen_random_uuid(),
  kind       lead_kind not null,
  email      text not null check (length(email) between 3 and 254),
  name       text check (length(name) <= 120),
  company    text check (length(company) <= 160),
  role       text check (length(role) <= 120),
  plan       text check (plan in ('socio', 'pro')),
  lang       text not null default 'es' check (lang in ('es', 'en', 'pt')),
  message    text check (length(message) <= 2000),
  created_at timestamptz not null default now()
);
-- En la lista de espera, un correo una sola vez.
create unique index marketing_leads_waitlist_email on marketing_leads (lower(email)) where kind = 'waitlist';
create index marketing_leads_recent on marketing_leads (kind, created_at desc);

-- Datos personales de prospectos: solo el sistema y el back-office (sin políticas para usuarios).
alter table marketing_leads enable row level security;
create trigger marketing_leads_audit after insert or update or delete on marketing_leads for each row execute function audit_capture();

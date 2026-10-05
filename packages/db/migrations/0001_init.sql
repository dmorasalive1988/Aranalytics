-- Pluma · 0001 · esquema inicial
-- Fuente de verdad del modelo; ver docs/02-modelo-de-datos.md.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Enumeraciones
-- -----------------------------------------------------------------------------
create type locale_code       as enum ('es', 'en', 'pt-BR');
create type app_role          as enum ('writer', 'ar_guest', 'sync_buyer', 'operator', 'approver', 'super_admin');
create type kyc_status        as enum ('not_started', 'pending', 'approved', 'rejected', 'needs_review');
create type plan_code         as enum ('socio', 'pro');
create type membership_status as enum ('pending_payment', 'active', 'past_due', 'suspended', 'canceled');
create type work_status       as enum ('draft', 'awaiting_signatures', 'splits_signed', 'sent_to_publisher', 'registered', 'disputed');
create type split_version_status as enum ('draft', 'pending_signatures', 'signed', 'rejected', 'superseded');
create type share_status      as enum ('pending', 'signed', 'rejected');
create type writer_role       as enum ('composer', 'lyricist', 'composer_lyricist', 'arranger', 'translator');
create type ai_declaration    as enum ('none', 'ai_assisted', 'ai_generated');
create type income_type       as enum ('performance', 'mechanical', 'youtube_ugc', 'sync', 'other');
create type match_status      as enum ('unmatched', 'auto_matched', 'suggested', 'manual_matched', 'suspense');
create type statement_file_status as enum ('uploaded', 'parsing', 'parsed', 'normalized', 'failed', 'superseded');
create type run_status        as enum ('draft', 'calculating', 'calculated', 'reconciled', 'unbalanced', 'approved', 'scheduled', 'published', 'invalidated');
create type distribution_status as enum ('payable', 'held_dispute', 'suspense');
create type ledger_entry_type as enum ('statement_credit', 'payout_debit', 'payout_reversal', 'adjustment', 'opening_carry');
create type payout_status     as enum ('requested', 'approved', 'sent', 'paid', 'failed', 'canceled');
create type request_type      as enum ('beat_seeks_topliner', 'seeks_producer', 'seeks_verse_or_hook', 'session_or_camp');
create type modality          as enum ('remote', 'in_person', 'hybrid');
create type request_status    as enum ('open', 'filled', 'closed', 'expired');
create type application_status as enum ('pending', 'accepted', 'declined', 'expired', 'withdrawn');
create type hold_status       as enum ('requested', 'approved', 'rejected', 'active', 'expired', 'released');
create type license_usage     as enum ('social_media', 'digital_ads', 'tv_film', 'videogame', 'other');
create type license_status    as enum ('submitted', 'awaiting_writers', 'writers_approved', 'writers_rejected', 'negotiating', 'issued', 'canceled');
create type dispute_status    as enum ('open', 'in_review', 'resolved', 'withdrawn');
create type notif_channel     as enum ('email', 'push', 'whatsapp', 'in_app');
create type notif_status      as enum ('queued', 'scheduled', 'sent', 'delivered', 'opened', 'bounced', 'failed', 'suppressed');

-- -----------------------------------------------------------------------------
-- Plataforma
-- -----------------------------------------------------------------------------
create table publishers (               -- preparado para white-label; hoy solo "Pluma"
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table settings (                 -- configuración editable por super admin (auditada)
  key         text primary key,         -- p. ej. 'sync.commission_bps', 'network.grace_days'
  value       jsonb not null,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Identidad y perfil
-- -----------------------------------------------------------------------------
create table users (                    -- 1:1 con auth.users
  id            uuid primary key,       -- = auth.users.id
  email         citext not null unique,
  locale        locale_code not null default 'es',
  kyc_status    kyc_status not null default 'not_started',
  email_verified_at timestamptz,
  mfa_required  boolean not null default false,      -- true para personal interno
  onboarding_completed_at timestamptz,
  deleted_at    timestamptz,                         -- anonimización (LGPD/CCPA)
  created_at    timestamptz not null default now()
);

create table user_roles (
  user_id     uuid not null references users(id),
  role        app_role not null,
  granted_by  uuid references users(id),
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);

create table pro_societies (            -- SAYCO, SACM, APDAYC, SAYCE, ASCAP, BMI, UBC, …
  code        text primary key,
  name        text not null,
  country     char(2) not null
);

create table writer_profiles (
  user_id        uuid primary key references users(id),
  publisher_id   uuid not null references publishers(id),
  legal_name     text not null,
  artist_name    text,
  country        char(2) not null,
  city           text,
  languages      locale_code[] not null default '{}',
  spoken_languages text[] not null default '{}',     -- idiomas de escritura (no solo de la UI)
  birth_date     date not null,
  society_code   text references pro_societies(code),
  society_other  text,
  ipi            text check (ipi ~ '^\d{9,11}$'),
  public_slug    citext unique,
  bio            text,
  dsp_links      jsonb not null default '{}',        -- {spotify, apple, youtube, …}
  network_visible boolean not null default true,     -- false por defecto para menores
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table guardians (                -- tutor legal de autores menores de edad
  id              uuid primary key default gen_random_uuid(),
  writer_user_id  uuid not null references writer_profiles(user_id),
  legal_name      text not null,
  email           citext not null,
  relationship    text not null,
  id_document_path text not null,                    -- bucket privado
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table tax_profiles (             -- datos fiscales cifrados (Vault/pgsodium)
  user_id         uuid primary key references users(id),
  tax_country     char(2) not null,
  tax_id_enc      bytea not null,
  tax_id_last4    text,
  entity_type     text not null default 'individual',
  forms           jsonb not null default '{}',       -- W-8BEN / W-9, RUT, CPF, …
  updated_at      timestamptz not null default now()
);

create table payout_methods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  provider        text not null,                     -- 'wise' | 'payoneer'
  currency        char(3) not null,
  details_enc     bytea not null,
  label           text not null,                     -- "Bancolombia ••4821"
  is_default      boolean not null default false,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table kyc_checks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  provider        text not null,
  provider_ref    text not null,
  status          kyc_status not null,
  risk_flags      jsonb not null default '[]',       -- PEP, sanciones, AML
  checked_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Documentos legales y firmas
-- -----------------------------------------------------------------------------
create table legal_documents (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                         -- 'admin_agreement' | 'terms' | 'privacy' | 'minor_consent'
  version     text not null,
  locale      locale_code not null,
  storage_path text not null,
  sha256      char(64) not null,
  effective_from date not null,
  unique (kind, version, locale)
);

create table signatures (               -- evidencia de cada firma
  id              uuid primary key default gen_random_uuid(),
  document_sha256 char(64) not null,
  document_kind   text not null,                     -- 'legal_document' | 'split_sheet'
  document_ref    uuid not null,
  signer_user_id  uuid references users(id),         -- null si es coautor invitado
  signer_name     text not null,
  signer_email    citext not null,
  on_behalf_of_user_id uuid references users(id),    -- tutor que firma por un menor
  method          text not null,                     -- 'session+otp' | 'link+otp'
  otp_verified_at timestamptz not null,
  ip              inet not null,
  user_agent      text not null,
  signed_at       timestamptz not null default now(),
  tsa_token       bytea                              -- RFC 3161, al cerrar el documento
);

create table agreements (               -- contratos aceptados por cada autor
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  legal_document_id uuid not null references legal_documents(id),
  signature_id    uuid not null references signatures(id),
  accepted_at     timestamptz not null default now(),
  terminated_at   timestamptz,
  termination_reason text
);

-- -----------------------------------------------------------------------------
-- Planes y membresía
-- -----------------------------------------------------------------------------
create table plans (
  code            plan_code primary key,
  publisher_id    uuid not null references publishers(id),
  commission_bps  int not null check (commission_bps between 0 and 10000),  -- socio 2000, pro 1500
  features        jsonb not null,  -- {sync:false, ar:false, analytics:false, daily_applications:N, featured:false, camps_priority:false}
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);

create table plan_prices (              -- soporte de precios por región [a definir]
  id              uuid primary key default gen_random_uuid(),
  plan_code       plan_code not null references plans(code),
  region          text not null default 'GLOBAL',    -- 'GLOBAL' | 'BR' | 'MX' | …
  amount_cents    int not null,
  currency        char(3) not null default 'USD',
  stripe_price_id text not null,
  valid_from      date not null,
  valid_to        date,
  unique (plan_code, region, valid_from)
);

create table memberships (
  user_id         uuid primary key references users(id),
  plan_code       plan_code not null references plans(code),
  status          membership_status not null,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  grace_ends_at   timestamptz,
  scheduled_plan_code plan_code,                     -- bajada a Socio al final del período
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  updated_at      timestamptz not null default now()
);

create table membership_plan_periods (  -- fuente de verdad: qué comisión aplicaba en una fecha
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  plan_code       plan_code not null,
  commission_bps  int not null,                      -- copiada al momento del cambio
  valid_from      timestamptz not null,
  valid_to        timestamptz,                       -- null = vigente
  exclude using gist (user_id with =, tstzrange(valid_from, coalesce(valid_to, 'infinity')) with &&)
);

create table membership_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  kind            text not null,                     -- 'new' | 'renewal' | 'upgrade_proration'
  amount_cents    int not null,
  currency        char(3) not null,
  stripe_invoice_id text unique not null,
  status          text not null,                     -- 'paid' | 'failed' | 'refunded'
  occurred_at     timestamptz not null
);

-- -----------------------------------------------------------------------------
-- Obras, grabaciones y splits
-- -----------------------------------------------------------------------------
create table works (
  id              uuid primary key default gen_random_uuid(),
  publisher_id    uuid not null references publishers(id),
  title           text not null,
  title_normalized text not null default '',          -- para detección de conflictos
  alt_titles      text[] not null default '{}',
  language        text not null,                     -- idioma de la letra (ISO 639-1)
  genre           text not null,
  lyrics          text,
  iswc            text unique check (iswc ~ '^T-?\d{3}\.?\d{3}\.?\d{3}-?\d$'),
  publisher_work_code text unique,                    -- código de obra del administrador asociado
  status          work_status not null default 'draft',
  ai_declaration  ai_declaration not null,           -- obligatoria al registrar
  ai_training_opt_in boolean not null default false, -- fase posterior; siempre false en MVP
  audio_sha256    char(64),
  lyrics_sha256   char(64),
  authorship_sealed_at timestamptz,
  authorship_tsa_token bytea,
  sync_opt_in     boolean not null default false,
  ar_opt_in       boolean not null default false,
  one_stop        boolean not null default false,    -- el autor controla y cede el máster
  opt_ins_suspended boolean not null default false,  -- membresía suspendida: se recuerda el opt-in
  -- metadatos de catálogo (sync / A&R)
  bpm             int check (bpm between 30 and 300),
  musical_key     text,
  moods           text[] not null default '{}',
  vocals          text,                               -- 'female' | 'male' | 'duet' | 'choir' | 'none'
  instrumental_available boolean not null default false,
  catalog_description text,
  search_tsv      tsvector,
  origin_request_id uuid,                            -- si nació en la Red
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
  -- Reglas por trigger: opt-ins de sync/A&R solo con plan Pro activo; A&R solo si no hay grabaciones.
);
create index works_title_trgm on works using gin (title_normalized extensions.gin_trgm_ops);
create index works_search_tsv on works using gin (search_tsv);

create table work_files (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid references works(id),
  owner_user_id   uuid not null references users(id),
  kind            text not null,                     -- 'demo_original' | 'demo_preview' | 'lyrics_doc' | 'instrumental'
  storage_path    text not null unique,
  sha256          char(64) not null,
  duration_ms     int,
  watermark_id    text,
  created_at      timestamptz not null default now()
);

create table recordings (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references works(id),
  isrc            text not null check (isrc ~ '^[A-Z]{2}[A-Z0-9]{3}\d{7}$'),
  title           text not null,
  artist          text not null,
  master_owner    text,
  master_controlled_by_writer boolean not null default false,
  unique (work_id, isrc)
);
create index recordings_isrc on recordings(isrc);

create table split_versions (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references works(id),
  version         int not null,
  status          split_version_status not null default 'draft',
  effective_from  date,                              -- se fija cuando todos firman
  split_sheet_sha256 char(64),                       -- hash del documento que se firma
  evidence_path   text,                              -- certificado de evidencia
  change_reason   text,
  created_by      uuid not null references users(id),
  submitted_at    timestamptz,
  completed_at    timestamptz,
  unique (work_id, version)
);

create table split_shares (
  id              uuid primary key default gen_random_uuid(),
  split_version_id uuid not null references split_versions(id),
  writer_user_id  uuid references users(id),         -- socio de Pluma
  external_name   text,                              -- coautor no socio
  external_email  citext,
  external_ipi    text,
  external_society text,
  role            writer_role not null,
  share_bps       int not null check (share_bps > 0 and share_bps <= 10000),
  administered    boolean not null,                  -- true solo si el titular es socio activo
  status          share_status not null default 'pending',
  invited_at      timestamptz,
  signature_id    uuid references signatures(id),
  signed_at       timestamptz,
  sign_token_hash char(64),                          -- enlace seguro (hash, no el token)
  sign_token_expires_at timestamptz,
  last_reminder_at timestamptz,
  check ((writer_user_id is not null) <> (external_email is not null))
);

create table work_status_history (
  id          bigserial primary key,
  work_id     uuid not null references works(id),
  from_status work_status,
  to_status   work_status not null,
  actor_id    uuid,
  note        text,
  at          timestamptz not null default now()
);

create table work_conflicts (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references works(id),
  conflicting_work_id uuid not null references works(id),
  reason          text not null,                     -- 'title_isrc' | 'iswc' | 'audio_hash'
  score           numeric(4,3) not null,
  status          text not null default 'open',      -- 'open' | 'dismissed' | 'escalated'
  reviewed_by     uuid references users(id),
  created_at      timestamptz not null default now()
);

create table disputes (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references works(id),
  split_version_id uuid references split_versions(id),
  raised_by_user_id uuid references users(id),
  raised_by_email citext,
  reason          text not null,
  status          dispute_status not null default 'open',
  resolution      text,
  resolved_by     uuid references users(id),
  opened_at       timestamptz not null default now(),
  resolved_at     timestamptz
);

create table publisher_submissions (    -- exportación de altas al administrador asociado
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,
  file_path       text not null,
  sha256          char(64) not null,
  work_ids        uuid[] not null,
  created_by      uuid not null references users(id),
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Salida de autores y herederos
create table writer_terminations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  requested_at    timestamptz not null default now(),
  effective_at    date,
  catalog_transfer_to text,
  final_settlement_run_id uuid,
  status          text not null default 'requested'
);

create table beneficiary_changes (
  id              uuid primary key default gen_random_uuid(),
  writer_user_id  uuid not null references users(id),
  beneficiary_name text not null,
  beneficiary_email citext not null,
  share_bps       int not null default 10000,
  documents       text[] not null,                   -- acta de defunción, sucesión, …
  status          text not null default 'pending',
  approved_by     uuid references users(id),
  effective_from  date,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Statements: ingesta, normalización y matching
-- -----------------------------------------------------------------------------
create table statement_periods (
  id              uuid primary key default gen_random_uuid(),
  publisher_id    uuid not null references publishers(id),
  provider        text not null,                     -- 'primary_administrator'
  code            text not null,                     -- '2026-Q2'
  pay_date        date not null,                     -- calendario oficial de pagos
  unique (provider, code)
);

create table statement_files (
  id              uuid primary key default gen_random_uuid(),
  period_id       uuid not null references statement_periods(id),
  provider        text not null,
  version         int not null,
  storage_path    text not null unique,              -- bucket write-once
  sha256          char(64) not null,
  original_name   text not null,
  mapping_version text not null,                     -- versión del mapeo del conector
  control_total   numeric(20,6),                     -- total declarado por el proveedor
  received_amount numeric(20,6) not null,            -- dinero efectivamente recibido
  received_currency char(3) not null,
  status          statement_file_status not null default 'uploaded',
  supersedes_id   uuid references statement_files(id),
  uploaded_by     uuid not null references users(id),
  uploaded_at     timestamptz not null default now(),
  unique (period_id, version)
);

create table statement_lines (          -- modelo normalizado único
  id              uuid primary key default gen_random_uuid(),
  file_id         uuid not null references statement_files(id),
  line_no         int not null,
  raw             jsonb not null,                    -- línea cruda tal cual (trazabilidad)
  provider_work_code text,
  work_title      text,
  iswc            text,
  writer_ipi      text,
  isrc            text,
  source          text not null,                     -- sociedad o DSP
  income_type     income_type not null,
  territory       char(2),
  exploitation_start date,
  exploitation_end   date,
  pay_period      text not null,
  currency        char(3) not null,
  gross           numeric(20,6) not null,
  provider_fee    numeric(20,6) not null default 0,
  net             numeric(20,6) not null,            -- puede ser negativo
  is_adjustment   boolean not null default false,
  adjusts_period  text,                              -- corrección de período anterior
  match_status    match_status not null default 'unmatched',
  matched_work_id uuid references works(id),
  match_method    text,                              -- 'publisher_code' | 'iswc' | 'ipi_title' | 'manual'
  match_confidence numeric(4,3),
  matched_by      uuid references users(id),
  unique (file_id, line_no)
);
create index statement_lines_match on statement_lines(file_id, match_status);

create table match_suggestions (
  line_id         uuid not null references statement_lines(id),
  work_id         uuid not null references works(id),
  score           numeric(4,3) not null,
  primary key (line_id, work_id)
);

create table work_aliases (             -- memoria de matching manual
  provider        text not null,
  alias_key       text not null,                     -- código o título normalizado + IPI
  work_id         uuid not null references works(id),
  created_by      uuid not null references users(id),
  primary key (provider, alias_key)
);

-- -----------------------------------------------------------------------------
-- Cálculo, conciliación y publicación
-- -----------------------------------------------------------------------------
create table fx_rates (
  id              uuid primary key default gen_random_uuid(),
  base            char(3) not null,
  quote           char(3) not null,
  rate            numeric(20,10) not null,
  source          text not null,                     -- 'ECB' | 'Wise' | 'Banco de la República' …
  as_of           timestamptz not null,
  unique (base, quote, source, as_of)
);

create table tax_withholding_rules (
  id              uuid primary key default gen_random_uuid(),
  residence_country char(2) not null,
  income_type     income_type,                       -- null = todos
  rate_bps        int not null,
  legal_reference text not null,
  valid_from      date not null,
  valid_to        date
);

create table advances (                 -- preparado; emitir adelantos está fuera del MVP
  id              uuid primary key default gen_random_uuid(),
  writer_user_id  uuid not null references users(id),
  amount_cents    bigint not null,
  currency        char(3) not null,
  recouped_cents  bigint not null default 0,
  issued_at       timestamptz not null
);

create table distribution_runs (
  id              uuid primary key default gen_random_uuid(),
  period_id       uuid not null references statement_periods(id),
  file_ids        uuid[] not null,
  status          run_status not null default 'draft',
  params_snapshot jsonb not null,                    -- comisiones, FX, reglas fiscales, versiones de split
  params_sha256   char(64) not null,
  calculated_by   uuid references users(id),
  calculated_at   timestamptz,
  approved_by     uuid references users(id),
  approved_at     timestamptz,
  scheduled_for   timestamptz,
  published_by    uuid references users(id),
  published_at    timestamptz,
  check (approved_by is null or approved_by <> calculated_by)   -- doble aprobación
);

create table distributions (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references distribution_runs(id),
  line_id         uuid not null references statement_lines(id),
  split_share_id  uuid references split_shares(id),
  writer_user_id  uuid references users(id),         -- null = suspenso
  share_bps       int not null,
  status          distribution_status not null,
  gross           numeric(20,6) not null,            -- moneda de la línea
  fx_rate_id      uuid references fx_rates(id),
  gross_payout_ccy numeric(20,6) not null,
  commission_bps  int not null,
  commission      numeric(20,6) not null,
  withholding_bps int not null default 0,
  withholding     numeric(20,6) not null default 0,
  recoupment      numeric(20,6) not null default 0,
  net             numeric(20,6) not null,
  hold_reason     text
);
create index distributions_run_writer on distributions(run_id, writer_user_id);

create table reconciliations (
  run_id          uuid primary key references distribution_runs(id),
  currency        char(3) not null,
  received_cents  bigint not null,
  control_total_cents bigint not null,
  parsed_total_cents  bigint not null,
  writers_net_cents   bigint not null,
  commission_cents    bigint not null,
  withholding_cents   bigint not null,
  recoupment_cents    bigint not null,
  held_cents          bigint not null,
  suspense_cents      bigint not null,
  rounding_cents      bigint not null,
  difference_cents    bigint generated always as (
    received_cents - (writers_net_cents + commission_cents + withholding_cents
                      + recoupment_cents + held_cents + suspense_cents + rounding_cents)) stored,
  balanced        boolean generated always as (
    received_cents = writers_net_cents + commission_cents + withholding_cents
                     + recoupment_cents + held_cents + suspense_cents + rounding_cents
    and parsed_total_cents = control_total_cents) stored,
  computed_at     timestamptz not null default now()
);

create table writer_statements (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references distribution_runs(id),
  period_id       uuid not null references statement_periods(id),
  writer_user_id  uuid not null references users(id),
  currency        char(3) not null,
  plan_code_applied plan_code not null,
  commission_bps_applied int not null,
  opening_balance_cents bigint not null,
  gross_cents     bigint not null,
  commission_cents bigint not null,
  withholding_cents bigint not null,
  recoupment_cents bigint not null,
  adjustments_cents bigint not null,
  held_cents      bigint not null,
  net_cents       bigint not null,
  closing_balance_cents bigint not null,             -- puede ser negativo: se arrastra
  top_work_id     uuid references works(id),
  pdf_path        text,
  pdf_sha256      char(64),
  csv_path        text,
  published_at    timestamptz,
  unique (period_id, writer_user_id)                 -- un statement oficial por autor y período
);

create table writer_ledger_entries (    -- el saldo es la suma; nunca un campo editable
  id              bigserial primary key,
  writer_user_id  uuid not null references users(id),
  type            ledger_entry_type not null,
  amount_cents    bigint not null,
  currency        char(3) not null,
  writer_statement_id uuid references writer_statements(id),
  payout_id       uuid,
  memo            text,
  created_at      timestamptz not null default now()
);
create view writer_balances as
  select writer_user_id, currency, sum(amount_cents) as balance_cents
  from writer_ledger_entries group by writer_user_id, currency;

create table tax_certificates (
  id              uuid primary key default gen_random_uuid(),
  writer_user_id  uuid not null references users(id),
  fiscal_year     int not null,
  country         char(2) not null,
  pdf_path        text not null,
  issued_at       timestamptz not null default now(),
  unique (writer_user_id, fiscal_year, country)
);

create table payouts (
  id              uuid primary key default gen_random_uuid(),
  writer_user_id  uuid not null references users(id),
  payout_method_id uuid not null references payout_methods(id),
  amount_cents    bigint not null check (amount_cents > 0),
  currency        char(3) not null,
  status          payout_status not null default 'requested',
  batch_id        uuid,
  prepared_by     uuid references users(id),
  approved_by     uuid references users(id),
  provider_ref    text,
  failure_reason  text,
  requested_at    timestamptz not null default now(),
  paid_at         timestamptz,
  check (approved_by is null or approved_by <> prepared_by)
);

-- -----------------------------------------------------------------------------
-- Red Pluma
-- -----------------------------------------------------------------------------
create table network_requests (
  id              uuid primary key default gen_random_uuid(),
  author_user_id  uuid not null references users(id),
  type            request_type not null,
  title           text not null,
  description     text not null,
  genre           text not null,
  languages       text[] not null,
  bpm             int,
  city            text,
  modality        modality not null,
  offered_share_bps int not null check (offered_share_bps between 1 and 9999),
  demo_file_id    uuid references work_files(id),
  status          request_status not null default 'open',
  featured        boolean not null default false,    -- perfil Pro
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table applications (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references network_requests(id),
  applicant_user_id uuid not null references users(id),
  message         text not null,
  accepted_share_bps int not null,                   -- debe igualar el split ofrecido
  sample_file_id  uuid references work_files(id),
  status          application_status not null default 'pending',
  reminder_sent_at timestamptz,
  expires_at      timestamptz not null,              -- creado + 7 días
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (request_id, applicant_user_id)
);

create table collaborations (           -- nace al aceptar; preparado para chat futuro
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references network_requests(id),
  application_id  uuid not null unique references applications(id),
  pre_agreed_shares jsonb not null,                  -- [{user_id, role, share_bps}]
  session_url     text,
  work_id         uuid references works(id),         -- "Cerrar canción"
  created_at      timestamptz not null default now(),
  closed_at       timestamptz
);

create table credits (                  -- créditos verificados del perfil
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  work_id         uuid references works(id),
  title           text not null,
  artist          text,
  role            text not null,
  dsp_url         text,
  verified        boolean not null default false,
  verified_source text,                              -- 'pluma_registry' | 'operator'
  strength        int not null default 0             -- para elegir los 3–5 más fuertes
);

create table audio_plays (
  id              bigserial primary key,
  file_id         uuid not null references work_files(id),
  listener_user_id uuid references users(id),
  context         text not null,                     -- 'network' | 'ar' | 'sync' | 'email'
  ip_hash         char(64),
  started_at      timestamptz not null default now(),
  listened_ms     int
);

-- -----------------------------------------------------------------------------
-- A&R
-- -----------------------------------------------------------------------------
create table ar_invitations (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null,
  company         text not null,
  invited_by      uuid not null references users(id),
  token_hash      char(64) not null unique,
  expires_at      timestamptz not null,
  accepted_user_id uuid references users(id),
  revoked_at      timestamptz
);

create table ar_interests (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references works(id),
  ar_user_id      uuid not null references users(id),
  message         text,
  created_at      timestamptz not null default now()
);

create table holds (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references works(id),
  requester_user_id uuid not null references users(id),
  duration_days   int not null check (duration_days in (30, 60, 90)),
  status          hold_status not null default 'requested',
  decided_by      uuid references users(id),
  starts_at       timestamptz,
  ends_at         timestamptz,
  fee_cents       bigint,                            -- cobro de holds: fuera del MVP
  created_at      timestamptz not null default now()
);
create unique index one_active_hold_per_work on holds(work_id) where status in ('approved', 'active');

-- -----------------------------------------------------------------------------
-- Sync
-- -----------------------------------------------------------------------------
create table sync_buyers (
  user_id         uuid primary key references users(id),
  company         text not null,
  company_type    text not null,                     -- 'agency' | 'production' | 'brand' | 'supervisor'
  country         char(2) not null,
  verified_at     timestamptz
);

create table sync_briefs (
  id              uuid primary key default gen_random_uuid(),
  buyer_user_id   uuid references users(id),         -- null = brief cargado por operador
  title           text not null,
  description     text not null,
  moods           text[] not null default '{}',
  genres          text[] not null default '{}',
  languages       text[] not null default '{}',
  usage           license_usage not null,
  territory       text not null,
  term_months     int,
  budget_min_cents bigint,
  budget_max_cents bigint,
  deadline        timestamptz,
  status          text not null default 'open',
  created_at      timestamptz not null default now()
);

create table brief_submissions (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid not null references sync_briefs(id),
  work_id         uuid not null references works(id),
  submitted_by    uuid not null references users(id),
  note            text,
  status          text not null default 'submitted', -- 'shortlisted' | 'passed' | 'licensed'
  created_at      timestamptz not null default now(),
  unique (brief_id, work_id)
);

create table sync_rate_card (           -- [tabla de tarifas a definir]
  id              uuid primary key default gen_random_uuid(),
  usage           license_usage not null,
  territory       text not null,                     -- 'LATAM' | 'US' | 'WORLD' | ISO2
  term_months     int not null,
  min_cents       bigint not null,
  max_cents       bigint not null,
  currency        char(3) not null default 'USD',
  valid_from      date not null,
  valid_to        date
);

create table license_requests (
  id              uuid primary key default gen_random_uuid(),
  buyer_user_id   uuid not null references users(id),
  work_id         uuid not null references works(id),
  brief_id        uuid references sync_briefs(id),
  usage           license_usage not null,
  territory       text not null,
  term_months     int not null,
  project_description text not null,
  quote_min_cents bigint,
  quote_max_cents bigint,
  rate_card_id    uuid references sync_rate_card(id),
  one_stop_requested boolean not null default false,
  status          license_status not null default 'submitted',
  operator_id     uuid references users(id),
  final_fee_cents bigint,
  pluma_commission_bps int,                          -- [porcentaje sync]
  license_doc_path text,
  created_at      timestamptz not null default now()
);

create table license_approvals (        -- cada autor socio de la obra aprueba o rechaza
  license_request_id uuid not null references license_requests(id),
  writer_user_id  uuid not null references users(id),
  decision        text,                              -- 'approved' | 'rejected'
  decided_at      timestamptz,
  primary key (license_request_id, writer_user_id)
);

-- -----------------------------------------------------------------------------
-- Eventos y notificaciones
-- -----------------------------------------------------------------------------
create table domain_events (            -- outbox transaccional
  id              uuid primary key default gen_random_uuid(),
  type            text not null,                     -- 'statement.published', …
  aggregate_type  text not null,
  aggregate_id    uuid not null,
  payload         jsonb not null,
  occurred_at     timestamptz not null default now(),
  dispatched_at   timestamptz
);
create index domain_events_pending on domain_events(occurred_at) where dispatched_at is null;

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references domain_events(id),
  recipient_user_id uuid references users(id),
  recipient_email citext,                            -- coautor invitado sin cuenta
  locale          locale_code not null,
  template        text not null,                     -- 'statement_published' | 'statement_published_zero' …
  idempotency_key text not null unique,              -- nunca dos veces al mismo autor por período
  data            jsonb not null,
  scheduled_for   timestamptz,
  is_test         boolean not null default false,
  created_at      timestamptz not null default now()
);

create table notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id),
  channel         notif_channel not null,
  status          notif_status not null default 'queued',
  provider_message_id text,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  bounced_at      timestamptz,
  error           text,
  unique (notification_id, channel)
);

create table notification_preferences (
  user_id         uuid not null references users(id),
  category        text not null,                     -- 'money' | 'splits' | 'network' | 'sync' | 'marketing'
  channel         notif_channel not null,
  enabled         boolean not null,
  primary key (user_id, category, channel)
);

create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  endpoint        text not null unique,
  keys            jsonb not null,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Auditoría inmutable y privacidad
-- -----------------------------------------------------------------------------
create table audit_log (
  id              bigserial primary key,
  actor_user_id   uuid,
  actor_role      text,
  action          text not null,                     -- tabla.operación: 'split_shares.update'
  command         text,                              -- comando de negocio: 'split.sign', 'run.approve' …
  entity_type     text not null,
  entity_id       text not null,
  before          jsonb,
  after           jsonb,
  ip              inet,
  user_agent      text,
  at              timestamptz not null default now(),
  prev_hash       char(64),
  hash            char(64) not null
);

create table data_subject_requests (    -- Habeas Data / LGPD / CCPA
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id),
  kind            text not null,                     -- 'access' | 'rectify' | 'delete' | 'portability'
  status          text not null default 'open',
  due_at          timestamptz not null,
  closed_at       timestamptz
);


-- Retos de verificación por código (firma de contratos y splits)
create table signature_challenges (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null,
  purpose         text not null,                     -- 'split_share' | 'agreement' | 'guardian_agreement'
  ref_id          uuid not null,
  code_hash       char(64) not null,
  attempts        int not null default 0,
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index signature_challenges_ref on signature_challenges(ref_id, purpose);

-- Búsqueda semántica (pgvector). Si la extensión no está disponible, la columna no se crea.
do $$
begin
  begin
    create extension if not exists vector with schema extensions;
  exception when others then
    raise notice 'pgvector no disponible: búsqueda semántica desactivada';
    return;
  end;
  alter table works add column embedding extensions.vector(1024);
  create index works_embedding on works using hnsw (embedding extensions.vector_cosine_ops);
end $$;

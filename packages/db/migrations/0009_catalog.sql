-- Pluma · 0009 · Catálogo A&R y Pluma Sync (fase e)
set search_path = public, extensions;

-- Búsqueda de texto del catálogo: título, títulos alternativos, género, moods, descripción e idioma.
create function works_search_tsv() returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.title, '') || ' ' || array_to_string(new.alt_titles, ' ')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.genre, '') || ' ' || array_to_string(new.moods, ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.catalog_description, '') || ' ' || coalesce(new.language, '')), 'C');
  return new;
end $$;
create trigger works_search_tsv before insert or update of title, alt_titles, genre, moods, catalog_description, language on works
  for each row execute function works_search_tsv();
update works set title = title;

-- Holds: mensaje del A&R y decisión del autor
alter table holds
  add column message text,
  add column decided_at timestamptz,
  add column reject_reason text;
create index holds_work on holds(work_id, status);

-- Un interés por A&R y obra
alter table ar_interests add constraint ar_interests_unique unique (work_id, ar_user_id);
alter table ar_invitations add column created_at timestamptz not null default now();

-- Compradores, briefs y licencias
alter table sync_buyers add column created_at timestamptz not null default now();
alter table sync_briefs add column closed_at timestamptz;
alter table license_requests
  add column decided_at timestamptz,
  add column issued_at timestamptz,
  add column operator_note text,
  add column buyer_company text;
create index license_requests_buyer on license_requests(buyer_user_id, created_at desc);
create index license_requests_work on license_requests(work_id);

-- Forma de onda de la versión de escucha (picos 0–100), para los resultados de Pluma Sync
alter table work_files add column waveform jsonb;

-- Auditoría de lo que faltaba
create trigger ar_invitations_audit after insert or update or delete on ar_invitations for each row execute function audit_capture('token_hash');
create trigger ar_interests_audit after insert or update or delete on ar_interests for each row execute function audit_capture();
create trigger sync_buyers_audit after insert or update or delete on sync_buyers for each row execute function audit_capture();
create trigger sync_briefs_audit after insert or update or delete on sync_briefs for each row execute function audit_capture();
create trigger brief_submissions_audit after insert or update or delete on brief_submissions for each row execute function audit_capture();

-- Tabla de tarifas REFERENCIAL por uso y territorio (USD, 12 meses). La real la define el equipo de Pluma.
insert into sync_rate_card (usage, territory, term_months, min_cents, max_cents, valid_from) values
  ('social_media', 'LATAM', 12,   50000,  150000, '2026-01-01'),
  ('social_media', 'US',    12,  100000,  300000, '2026-01-01'),
  ('social_media', 'WORLD', 12,  200000,  500000, '2026-01-01'),
  ('digital_ads',  'LATAM', 12,  150000,  400000, '2026-01-01'),
  ('digital_ads',  'US',    12,  300000, 1000000, '2026-01-01'),
  ('digital_ads',  'WORLD', 12,  600000, 2000000, '2026-01-01'),
  ('tv_film',      'LATAM', 12,  200000,  600000, '2026-01-01'),
  ('tv_film',      'US',    12,  500000, 1500000, '2026-01-01'),
  ('tv_film',      'WORLD', 12, 1000000, 3500000, '2026-01-01'),
  ('videogame',    'LATAM', 12,  100000,  300000, '2026-01-01'),
  ('videogame',    'US',    12,  250000,  800000, '2026-01-01'),
  ('videogame',    'WORLD', 12,  500000, 1500000, '2026-01-01'),
  ('other',        'LATAM', 12,   80000,  250000, '2026-01-01'),
  ('other',        'US',    12,  150000,  500000, '2026-01-01'),
  ('other',        'WORLD', 12,  300000,  900000, '2026-01-01');

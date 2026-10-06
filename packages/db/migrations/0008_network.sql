-- Pluma · 0008 · Red Pluma (fase d)
set search_path = public, extensions;

-- Solicitudes: moderación, renovación y filtros
alter table network_requests
  add column hidden_at     timestamptz,
  add column hidden_reason text,
  add column hidden_by     uuid references users(id),
  add column renewed_at    timestamptz,
  add column closed_at     timestamptz,
  add constraint network_requests_title_len check (char_length(title) between 3 and 120),
  add constraint network_requests_desc_len check (char_length(description) between 10 and 2000);
create index network_requests_board on network_requests(status, expires_at desc) where hidden_at is null;
create index network_requests_author on network_requests(author_user_id, created_at desc);

-- Postulaciones: cupo diario por persona y bandeja por solicitud
create index applications_quota on applications(applicant_user_id, created_at desc);
create index applications_request on applications(request_id, status);
alter table applications add constraint applications_message_len check (char_length(message) between 10 and 1000);

-- Colaboraciones: quién cierra la canción
alter table collaborations add column closed_by uuid references users(id);

-- Perfil público: rol principal
alter table writer_profiles add column main_role writer_role;

-- Créditos declarados por el autor: los verifica un operador (los de obras registradas en Pluma se calculan solos)
alter table credits
  add column created_at    timestamptz not null default now(),
  add column reviewed_by   uuid references users(id),
  add column reviewed_at   timestamptz,
  add column rejected_reason text;
create index credits_user on credits(user_id);
create index credits_pending on credits(created_at) where not verified and reviewed_at is null;

-- Escuchas: consultas por archivo
create index audio_plays_file on audio_plays(file_id, started_at desc);

-- Auditoría de lo que cambia estado en la red (las tablas ya tenían RLS desde 0003)
create trigger network_requests_audit after insert or update or delete on network_requests for each row execute function audit_capture();
create trigger applications_audit after insert or update or delete on applications for each row execute function audit_capture();
create trigger collaborations_audit after insert or update or delete on collaborations for each row execute function audit_capture();
create trigger credits_audit after insert or update or delete on credits for each row execute function audit_capture();

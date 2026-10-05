-- Pluma · 0002 · funciones, reglas en base de datos y auditoría inmutable encadenada
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Contexto del actor: los servicios lo fijan con set_config(..., true) en cada transacción.
-- ---------------------------------------------------------------------------
create function pluma_setting(k text) returns text language sql stable as $$
  select nullif(current_setting(k, true), '')
$$;

create function pluma_actor_id() returns uuid language sql stable as $$
  select coalesce(pluma_setting('pluma.actor_id')::uuid, auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['writer_profiles', 'tax_profiles', 'memberships', 'plans', 'works'] loop
    execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Splits: una versión solo pasa a firma si suma exactamente 100,00 % (10000 pb).
-- ---------------------------------------------------------------------------
create function assert_split_total() returns trigger language plpgsql as $$
begin
  if new.status = 'pending_signatures' and old.status = 'draft' then
    if (select coalesce(sum(share_bps), 0) from split_shares where split_version_id = new.id) <> 10000 then
      raise exception 'SPLIT_TOTAL_NOT_100' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger split_total_check before update of status on split_versions
  for each row execute function assert_split_total();

-- Una versión enviada a firma ya no admite cambios en sus participaciones (solo el estado de firma).
create function freeze_submitted_shares() returns trigger language plpgsql as $$
declare v_status split_version_status;
begin
  select status into v_status from split_versions where id = coalesce(new.split_version_id, old.split_version_id);
  if v_status <> 'draft' then
    if tg_op = 'INSERT' or tg_op = 'DELETE'
       or new.share_bps <> old.share_bps or new.role <> old.role
       or new.writer_user_id is distinct from old.writer_user_id
       or new.external_email is distinct from old.external_email then
      raise exception 'SPLIT_VERSION_FROZEN' using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger split_shares_frozen before insert or update or delete on split_shares
  for each row execute function freeze_submitted_shares();

-- ---------------------------------------------------------------------------
-- Opt-ins de catálogo: solo con plan Pro vigente (o en gracia). Defensa en profundidad:
-- los servicios ya lo validan con @pluma/domain.
-- ---------------------------------------------------------------------------
create function assert_catalog_opt_in() returns trigger language plpgsql as $$
declare ok boolean;
begin
  if (new.sync_opt_in and not coalesce(old.sync_opt_in, false)) or (new.ar_opt_in and not coalesce(old.ar_opt_in, false)) then
    select exists (
      select 1 from memberships m
      where m.user_id = new.created_by and m.plan_code = 'pro'
        and m.status in ('active', 'past_due')
    ) into ok;
    if not ok then
      raise exception 'PLAN_REQUIRES_PRO' using errcode = 'check_violation';
    end if;
  end if;
  if new.ar_opt_in and not coalesce(old.ar_opt_in, false)
     and exists (select 1 from recordings r where r.work_id = new.id) then
    raise exception 'AR_REQUIRES_UNRECORDED' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger works_catalog_opt_in before insert or update of sync_opt_in, ar_opt_in on works
  for each row execute function assert_catalog_opt_in();

-- ---------------------------------------------------------------------------
-- Tablas de solo inserción
-- ---------------------------------------------------------------------------
create function reject_mutation() returns trigger language plpgsql as $$
begin
  raise exception '%_IS_APPEND_ONLY', upper(tg_table_name) using errcode = 'insufficient_privilege';
end $$;

create trigger audit_log_append_only before update or delete or truncate on audit_log
  for each statement execute function reject_mutation();
create trigger ledger_append_only before update or delete or truncate on writer_ledger_entries
  for each statement execute function reject_mutation();

-- Firmas: solo se puede agregar el sello de tiempo una vez; la evidencia no cambia.
create function signatures_seal_only() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'SIGNATURES_IS_APPEND_ONLY'; end if;
  if (to_jsonb(new) - 'tsa_token') <> (to_jsonb(old) - 'tsa_token') or old.tsa_token is not null then
    raise exception 'SIGNATURES_IS_APPEND_ONLY';
  end if;
  return new;
end $$;
create trigger signatures_immutable before update or delete on signatures
  for each row execute function signatures_seal_only();

-- Archivos crudos de statements: ruta, hash y montos recibidos no se modifican.
create function statement_files_raw_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' or new.storage_path <> old.storage_path or new.sha256 <> old.sha256
     or new.received_amount <> old.received_amount or new.version <> old.version then
    raise exception 'STATEMENT_FILE_RAW_IS_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger statement_files_immutable before update or delete on statement_files
  for each row execute function statement_files_raw_immutable();

-- ---------------------------------------------------------------------------
-- Auditoría encadenada por hash: hash = sha256(prev_hash || '|' || contenido canónico).
-- ---------------------------------------------------------------------------
create function audit_canonical(
  p_actor uuid, p_role text, p_action text, p_command text, p_entity_type text, p_entity_id text,
  p_before jsonb, p_after jsonb, p_ip inet, p_ua text, p_at timestamptz
) returns text language sql immutable as $$
  select concat_ws('|',
    coalesce(p_actor::text, '-'), coalesce(p_role, '-'), p_action, coalesce(p_command, '-'),
    p_entity_type, p_entity_id, coalesce(p_before::text, '-'), coalesce(p_after::text, '-'),
    coalesce(host(p_ip), '-'), coalesce(p_ua, '-'),
    to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
$$;

create function audit_append(
  p_action text, p_entity_type text, p_entity_id text, p_before jsonb, p_after jsonb
) returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prev char(64);
  v_at timestamptz := clock_timestamp();
  v_actor uuid := pluma_actor_id();
  v_role text := pluma_setting('pluma.actor_role');
  v_command text := pluma_setting('pluma.command');
  v_ip inet := pluma_setting('pluma.ip')::inet;
  v_ua text := pluma_setting('pluma.user_agent');
  v_id bigint;
begin
  -- Serializa las escrituras de auditoría para que la cadena sea lineal.
  perform pg_advisory_xact_lock(724310001);
  select hash into v_prev from audit_log order by id desc limit 1;
  insert into audit_log (actor_user_id, actor_role, action, command, entity_type, entity_id, before, after, ip, user_agent, at, prev_hash, hash)
  values (v_actor, v_role, p_action, v_command, p_entity_type, p_entity_id, p_before, p_after, v_ip, v_ua, v_at, v_prev,
    encode(digest(coalesce(v_prev, '') || '|' ||
      audit_canonical(v_actor, v_role, p_action, v_command, p_entity_type, p_entity_id, p_before, p_after, v_ip, v_ua, v_at), 'sha256'), 'hex'))
  returning id into v_id;
  return v_id;
end $$;

-- Trigger genérico. TG_ARGV = columnas a excluir (datos cifrados o voluminosos).
create function audit_capture() returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_col text;
  v_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_before := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_after := to_jsonb(new); end if;
  if tg_nargs > 0 then
    foreach v_col in array tg_argv loop
      v_before := v_before - v_col;
      v_after := v_after - v_col;
    end loop;
  end if;
  if tg_op = 'UPDATE' and v_before = v_after then return new; end if;
  v_id := coalesce(v_after ->> 'id', v_before ->> 'id', v_after ->> 'user_id', v_before ->> 'user_id',
                   v_after ->> 'code', v_before ->> 'code', v_after ->> 'key', v_before ->> 'key',
                   v_after ->> 'run_id', v_before ->> 'run_id', '?');
  perform audit_append(tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_before, v_after);
  return coalesce(new, old);
end $$;

-- Todo lo que toca dinero, splits, contratos, planes, roles y configuración.
do $$
declare
  t record;
begin
  for t in select * from (values
    ('users', array['email']), ('user_roles', array[]::text[]), ('writer_profiles', array[]::text[]),
    ('guardians', array[]::text[]), ('tax_profiles', array['tax_id_enc']), ('payout_methods', array['details_enc']),
    ('kyc_checks', array[]::text[]), ('legal_documents', array[]::text[]), ('signatures', array[]::text[]),
    ('agreements', array[]::text[]), ('plans', array[]::text[]), ('plan_prices', array[]::text[]),
    ('memberships', array[]::text[]), ('membership_plan_periods', array[]::text[]), ('membership_payments', array[]::text[]),
    ('works', array['lyrics', 'search_tsv', 'embedding', 'authorship_tsa_token']), ('recordings', array[]::text[]),
    ('split_versions', array[]::text[]), ('split_shares', array['sign_token_hash']),
    ('disputes', array[]::text[]), ('work_conflicts', array[]::text[]), ('publisher_submissions', array[]::text[]),
    ('writer_terminations', array[]::text[]), ('beneficiary_changes', array[]::text[]),
    ('statement_files', array[]::text[]), ('fx_rates', array[]::text[]), ('tax_withholding_rules', array[]::text[]),
    ('advances', array[]::text[]), ('distribution_runs', array['params_snapshot']), ('reconciliations', array[]::text[]),
    ('writer_statements', array[]::text[]), ('writer_ledger_entries', array[]::text[]), ('payouts', array[]::text[]),
    ('holds', array[]::text[]), ('license_requests', array[]::text[]), ('license_approvals', array[]::text[]),
    ('sync_rate_card', array[]::text[]), ('settings', array[]::text[]), ('data_subject_requests', array[]::text[])
  ) as x(name, excluded) loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function audit_capture(%s)',
      t.name || '_audit', t.name,
      coalesce((select string_agg(quote_literal(c), ', ') from unnest(t.excluded) c), ''));
  end loop;
end $$;

-- Verificación de la cadena: devuelve el primer id roto, o null si está íntegra.
create function audit_verify_chain() returns bigint language plpgsql stable set search_path = public, extensions as $$
declare
  r audit_log;
  v_prev char(64) := null;
begin
  for r in select * from audit_log order by id loop
    if r.prev_hash is distinct from v_prev or r.hash <> encode(digest(coalesce(v_prev, '') || '|' ||
       audit_canonical(r.actor_user_id, r.actor_role, r.action, r.command, r.entity_type, r.entity_id,
                       r.before, r.after, r.ip, r.user_agent, r.at), 'sha256'), 'hex') then
      return r.id;
    end if;
    v_prev := r.hash;
  end loop;
  return null;
end $$;

-- Pluma · 0003 · Row Level Security
-- Modelo: el rol `authenticated` SOLO LEE, filtrado por RLS. Toda escritura pasa por los servicios
-- del servidor (conexión privilegiada), que validan reglas de negocio y fijan el contexto de auditoría.
set search_path = public, extensions;

create function has_role(r app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = r)
$$;

create function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role in ('operator', 'approver', 'super_admin'))
$$;

create function is_work_member(w uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from works where id = w and created_by = auth.uid())
      or exists (select 1 from split_versions sv join split_shares ss on ss.split_version_id = sv.id
                 where sv.work_id = w and ss.writer_user_id = auth.uid())
$$;

-- RLS en todas las tablas + lectura para personal interno.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (is_staff())', t);
  end loop;
end $$;

-- Permisos: lectura para authenticated (RLS filtra), nada de escritura.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
grant select on plans, plan_prices, pro_societies, legal_documents to anon;

-- Catálogos públicos
create policy public_read on plans for select to anon, authenticated using (active);
create policy public_read on plan_prices for select to anon, authenticated using (true);
create policy public_read on pro_societies for select to anon, authenticated using (true);
create policy public_read on legal_documents for select to anon, authenticated using (true);

-- Lo propio del usuario
create policy own_read on users for select to authenticated using (id = auth.uid());
create policy own_read on user_roles for select to authenticated using (user_id = auth.uid());
create policy own_read on writer_profiles for select to authenticated using (user_id = auth.uid());
create policy own_read on guardians for select to authenticated using (writer_user_id = auth.uid());
create policy own_read on tax_profiles for select to authenticated using (user_id = auth.uid());
create policy own_read on payout_methods for select to authenticated using (user_id = auth.uid());
create policy own_read on kyc_checks for select to authenticated using (user_id = auth.uid());
create policy own_read on signatures for select to authenticated using (signer_user_id = auth.uid() or on_behalf_of_user_id = auth.uid());
create policy own_read on agreements for select to authenticated using (user_id = auth.uid());
create policy own_read on memberships for select to authenticated using (user_id = auth.uid());
create policy own_read on membership_plan_periods for select to authenticated using (user_id = auth.uid());
create policy own_read on membership_payments for select to authenticated using (user_id = auth.uid());
create policy own_read on notifications for select to authenticated using (recipient_user_id = auth.uid());
create policy own_read on notification_preferences for select to authenticated using (user_id = auth.uid());
create policy own_read on push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy own_read on data_subject_requests for select to authenticated using (user_id = auth.uid());
create policy own_read on payouts for select to authenticated using (writer_user_id = auth.uid());
create policy own_read on writer_ledger_entries for select to authenticated using (writer_user_id = auth.uid());
create policy own_read on tax_certificates for select to authenticated using (writer_user_id = auth.uid());

-- Obras: creador y coautores socios
create policy member_read on works for select to authenticated using (is_work_member(id));
create policy member_read on recordings for select to authenticated using (is_work_member(work_id));
create policy member_read on split_versions for select to authenticated using (is_work_member(work_id));
create policy member_read on split_shares for select to authenticated
  using (exists (select 1 from split_versions sv where sv.id = split_version_id and is_work_member(sv.work_id)));
create policy member_read on work_status_history for select to authenticated using (is_work_member(work_id));
create policy member_read on disputes for select to authenticated using (is_work_member(work_id));
create policy owner_read on work_conflicts for select to authenticated
  using (exists (select 1 from works w where w.id = work_id and w.created_by = auth.uid()));
create policy member_read on work_files for select to authenticated
  using (owner_user_id = auth.uid() or (work_id is not null and is_work_member(work_id)));

-- Dinero: solo statements publicados
create policy own_published on writer_statements for select to authenticated
  using (writer_user_id = auth.uid() and published_at is not null);
create policy own_published on distributions for select to authenticated
  using (writer_user_id = auth.uid() and exists (
    select 1 from writer_statements s where s.run_id = distributions.run_id
      and s.writer_user_id = auth.uid() and s.published_at is not null));

-- Saldo calculado: la vista respeta la RLS del ledger
alter view writer_balances set (security_invoker = true);

-- Vistas de catálogo (lo único que verán A&R y compradores de sync; fases d y e)
create view ar_catalog_v with (security_barrier) as
  select w.id, w.title, w.language, w.genre, w.bpm, w.moods, w.vocals,
         left(w.lyrics, 280) as lyrics_excerpt, wp.artist_name
  from works w
  join writer_profiles wp on wp.user_id = w.created_by
  where w.ar_opt_in and not w.opt_ins_suspended and w.status in ('splits_signed', 'sent_to_publisher', 'registered')
    and not exists (select 1 from recordings r where r.work_id = w.id);

create view sync_catalog_v with (security_barrier) as
  select w.id, w.title, w.language, w.genre, w.bpm, w.musical_key, w.moods, w.vocals,
         w.instrumental_available, w.one_stop, w.catalog_description
  from works w
  where w.sync_opt_in and not w.opt_ins_suspended and w.status in ('splits_signed', 'sent_to_publisher', 'registered');

revoke all on ar_catalog_v, sync_catalog_v from anon, authenticated;

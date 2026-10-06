-- Pluma · 0005 · ajustes para el pipeline de statements y pagos (fase b)
set search_path = public, extensions;

alter table statement_files
  add column control_totals jsonb not null default '{}',   -- total de control por moneda, tal como lo declara el archivo
  add column parse_errors jsonb not null default '[]',
  add column line_count int not null default 0;
create unique index statement_files_period_sha on statement_files(period_id, sha256);

alter table distribution_runs
  add column received_cents bigint,
  add column test_sent_at timestamptz,
  add column invalidated_reason text;

-- Una sola corrida viva por período (las anteriores se invalidan).
create unique index distribution_runs_one_live on distribution_runs(period_id)
  where status in ('draft', 'calculating', 'calculated', 'reconciled', 'unbalanced', 'approved', 'scheduled');

create index distributions_line on distributions(line_id);
create index statement_lines_work on statement_lines(matched_work_id);

-- El calendario oficial de pagos es visible para los autores (próximo statement).
create policy authenticated_read on statement_periods for select to authenticated using (true);

-- Desglose del statement: líneas de las distribuciones propias ya publicadas.
create policy own_published_lines on statement_lines for select to authenticated
  using (exists (select 1 from distributions d join writer_statements s on s.run_id = d.run_id and s.writer_user_id = d.writer_user_id
                 where d.line_id = statement_lines.id and d.writer_user_id = auth.uid() and s.published_at is not null));

insert into settings (key, value) values ('statements.default_currency', '"USD"') on conflict do nothing;

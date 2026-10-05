-- Pluma · 0004 · datos de referencia (no son datos de ejemplo)
set search_path = public, extensions;

insert into publishers (id, name) values ('00000000-0000-4000-8000-000000000001', 'Pluma');

insert into pro_societies (code, name, country) values
  ('SAYCO', 'Sociedad de Autores y Compositores de Colombia', 'CO'),
  ('SACM', 'Sociedad de Autores y Compositores de México', 'MX'),
  ('APDAYC', 'Asociación Peruana de Autores y Compositores', 'PE'),
  ('SAYCE', 'Sociedad de Autores y Compositores Ecuatorianos', 'EC'),
  ('ASCAP', 'American Society of Composers, Authors and Publishers', 'US'),
  ('BMI', 'Broadcast Music, Inc.', 'US'),
  ('UBC', 'União Brasileira de Compositores', 'BR');

insert into plans (code, publisher_id, commission_bps, features) values
  ('socio', '00000000-0000-4000-8000-000000000001', 2000,
   '{"network": true, "sync": false, "ar": false, "analytics": false, "featuredProfile": false, "campsPriority": false, "dailyApplications": 3}'),
  ('pro', '00000000-0000-4000-8000-000000000001', 1500,
   '{"network": true, "sync": true, "ar": true, "analytics": true, "featuredProfile": true, "campsPriority": true, "dailyApplications": 10}');

insert into plan_prices (plan_code, region, amount_cents, currency, stripe_price_id, valid_from) values
  ('socio', 'GLOBAL', 2000, 'USD', 'price_socio_annual', '2026-01-01'),
  ('pro', 'GLOBAL', 5000, 'USD', 'price_pro_annual', '2026-01-01');

insert into settings (key, value) values
  ('membership.grace_days', '15'),
  ('membership.renewal_notice_days', '15'),
  ('splits.invitation_ttl_days', '14'),
  ('splits.reminder_every_days', '3'),
  ('sync.commission_bps', '3000'),
  ('payouts.minimum_cents', '2000');

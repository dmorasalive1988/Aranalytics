-- Pluma · 0011 · La analítica de regalías queda para todos los planes (antes solo Pro).
set search_path = public, extensions;
update plans set features = jsonb_set(features, '{analytics}', 'true') where code = 'socio';

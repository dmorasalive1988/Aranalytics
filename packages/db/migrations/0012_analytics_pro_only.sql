-- Pluma · 0012 · La analítica vuelve a ser solo del plan Pro (revierte 0011).
set search_path = public, extensions;
update plans set features = jsonb_set(features, '{analytics}', 'false') where code = 'socio';

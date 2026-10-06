-- Pluma · 0007 · cierre de permisos (Supabase expone el esquema public por su API con la clave anónima)
set search_path = public, extensions;

-- Funciones: nadie las ejecuta por la API. Solo las que usan las políticas de RLS quedan para authenticated.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;
grant execute on function has_role(app_role), is_staff(), is_work_member(uuid), pluma_actor_id(), pluma_setting(text) to authenticated;

-- Tablas: anon y authenticated solo leen (y RLS filtra); también para tablas creadas después.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Las extensiones viven en `extensions`: que estén en el search_path de las conexiones de la app.
do $$ begin
  execute format('alter role %I set search_path = public, extensions', current_user);
exception when insufficient_privilege then null;
end $$;

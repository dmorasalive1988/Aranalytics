-- Pluma · 0006 · notificaciones multicanal (fase c)
set search_path = public, extensions;

-- Centro de notificaciones dentro de la app
alter table notifications
  add column category text not null default 'general',
  add column read_at timestamptz;
create index notifications_inbox on notifications(recipient_user_id, created_at desc);

-- Entregas: intentos y búsqueda por id del proveedor (webhooks)
alter table notification_deliveries add column attempts int not null default 0;
create index notification_deliveries_provider on notification_deliveries(provider_message_id);

-- WhatsApp opcional: número verificado por la persona y consentimiento explícito
alter table users
  add column phone_e164 text check (phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  add column whatsapp_opt_in_at timestamptz;

-- Supresión: correos que rebotaron de forma permanente o marcaron spam
create table email_suppressions (
  email       citext primary key,
  reason      text not null,          -- 'hard_bounce' | 'spam_complaint' | 'manual'
  detail      text,
  created_at  timestamptz not null default now()
);
alter table email_suppressions enable row level security;
create policy staff_read on email_suppressions for select to authenticated using (is_staff());

-- Cada persona administra sus suscripciones push y preferencias (las escrituras siguen pasando por el servidor)
create trigger users_phone_audit after update of phone_e164, whatsapp_opt_in_at on users for each row execute function audit_capture('email');

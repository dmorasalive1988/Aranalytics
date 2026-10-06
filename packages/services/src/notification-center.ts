import type { EmailEvent, PushSubscriptionData } from '@pluma/adapters';
import { and, desc, eq, inArray, isNull, lt, t, withSystem, sql } from '@pluma/db';
import { DomainError } from '@pluma/domain';
import { MANDATORY_EMAIL, renderPush, type NotificationCategory, type TemplateName } from '@pluma/emails';
import * as admin from './admin';
import type { Deps, RequestCtx } from './deps';
import type { AppLocale } from './format';
import { defaultPreference, sendNotification } from './notifications';

export type PrefChannel = 'email' | 'push' | 'whatsapp';
/** Categorías que hoy generan avisos (red y sync se suman en las fases d y e). */
export const PREF_CATEGORIES: readonly NotificationCategory[] = ['money', 'splits', 'membership', 'works'];
const CHANNELS: readonly PrefChannel[] = ['email', 'push', 'whatsapp'];

const writerCtx = (userId: string, command: string, ctx?: RequestCtx) => ({ actorId: userId, actorRole: 'writer' as const, command, ...ctx });

/* ------------------------------- Preferencias ------------------------------ */

export async function getPreferences(deps: Deps, userId: string) {
  const rows = await deps.db.select().from(t.notificationPreferences).where(eq(t.notificationPreferences.userId, userId));
  const [u] = await deps.db.select({ phone: t.users.phoneE164, optIn: t.users.whatsappOptInAt }).from(t.users).where(eq(t.users.id, userId));
  const devices = await deps.db.select({ endpoint: t.pushSubscriptions.endpoint }).from(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, userId));
  return {
    categories: PREF_CATEGORIES.map((category) => ({
      category,
      channels: Object.fromEntries(
        CHANNELS.map((c) => {
          const locked = c === 'email' && MANDATORY_EMAIL.includes(category);
          const saved = rows.find((r) => r.category === category && r.channel === c)?.enabled;
          return [c, { enabled: locked ? true : (saved ?? defaultPreference(category, c)), locked }];
        }),
      ) as Record<PrefChannel, { enabled: boolean; locked: boolean }>,
    })),
    push: { publicKey: deps.push.publicKey, devices: devices.map((d) => d.endpoint) },
    whatsapp: { available: !!deps.whatsapp, phone: u?.phone ?? null, optedIn: !!u?.optIn },
  };
}

export async function setPreference(deps: Deps, userId: string, category: NotificationCategory, channel: PrefChannel, enabled: boolean) {
  if (!PREF_CATEGORIES.includes(category) || !CHANNELS.includes(channel)) throw new DomainError('INVALID_PREFERENCE');
  if (channel === 'email' && MANDATORY_EMAIL.includes(category) && !enabled) throw new DomainError('EMAIL_MANDATORY');
  await withSystem(deps.db, writerCtx(userId, 'notifications.set_preference'), (tx) =>
    tx
      .insert(t.notificationPreferences)
      .values({ userId, category, channel, enabled })
      .onConflictDoUpdate({ target: [t.notificationPreferences.userId, t.notificationPreferences.category, t.notificationPreferences.channel], set: { enabled } }),
  );
}

/* ---------------------------------- Push ---------------------------------- */

export async function subscribePush(deps: Deps, userId: string, sub: PushSubscriptionData) {
  let url: URL;
  try {
    url = new URL(sub.endpoint);
  } catch {
    throw new DomainError('PUSH_INVALID');
  }
  if (url.protocol !== 'https:' || !sub.keys?.p256dh || !sub.keys?.auth) throw new DomainError('PUSH_INVALID');
  await withSystem(deps.db, writerCtx(userId, 'notifications.push_subscribe'), (tx) =>
    tx
      .insert(t.pushSubscriptions)
      .values({ userId, endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } })
      .onConflictDoUpdate({ target: t.pushSubscriptions.endpoint, set: { userId, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } } }),
  );
}

export async function unsubscribePush(deps: Deps, userId: string, endpoint: string) {
  await withSystem(deps.db, writerCtx(userId, 'notifications.push_unsubscribe'), (tx) =>
    tx.delete(t.pushSubscriptions).where(and(eq(t.pushSubscriptions.userId, userId), eq(t.pushSubscriptions.endpoint, endpoint))),
  );
}

/* -------------------------------- WhatsApp -------------------------------- */

/** Normaliza un número a E.164 (+57…). Acepta espacios, guiones y paréntesis. */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim().replace(/[\s().-]/g, '');
  const e164 = s.startsWith('00') ? `+${s.slice(2)}` : s;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** Alta con consentimiento explícito, o baja (phone = null). */
export async function setWhatsApp(deps: Deps, userId: string, input: { phone: string | null; consent: boolean }, ctx: RequestCtx) {
  if (input.phone === null) {
    await withSystem(deps.db, writerCtx(userId, 'notifications.whatsapp_opt_out', ctx), (tx) => tx.update(t.users).set({ phoneE164: null, whatsappOptInAt: null }).where(eq(t.users.id, userId)));
    return;
  }
  if (!deps.whatsapp) throw new DomainError('WHATSAPP_UNAVAILABLE');
  const phone = normalizePhone(input.phone);
  if (!phone) throw new DomainError('PHONE_INVALID');
  if (!input.consent) throw new DomainError('CONSENT_REQUIRED');
  await withSystem(deps.db, writerCtx(userId, 'notifications.whatsapp_opt_in', ctx), (tx) =>
    tx.update(t.users).set({ phoneE164: phone, whatsappOptInAt: deps.now().toISOString() }).where(eq(t.users.id, userId)),
  );
}

/* ------------------------------ Centro in-app ------------------------------ */

export interface InboxItem {
  id: string;
  category: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
}

export async function inbox(deps: Deps, userId: string, opts: { limit?: number; before?: string } = {}): Promise<{ items: InboxItem[]; next: string | null }> {
  const limit = Math.min(opts.limit ?? 30, 100);
  const rows = await deps.db
    .select()
    .from(t.notifications)
    .where(and(eq(t.notifications.recipientUserId, userId), eq(t.notifications.isTest, false), opts.before ? lt(t.notifications.createdAt, opts.before) : undefined))
    .orderBy(desc(t.notifications.createdAt))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map((n) => {
    const p = renderPush(n.template as TemplateName, n.locale as AppLocale, n.data as never);
    // Los enlaces de los correos son absolutos; dentro de la app basta la ruta.
    const url = p.url.startsWith(deps.appUrl) ? p.url.slice(deps.appUrl.length) || '/' : p.url;
    return { id: n.id, category: n.category, title: p.title, body: p.body, url, createdAt: n.createdAt, read: !!n.readAt };
  });
  return { items, next: rows.length > limit ? items[items.length - 1]!.createdAt : null };
}

export async function unreadCount(deps: Deps, userId: string) {
  const [r] = await deps.db.execute<{ n: number }>(sql`select count(*)::int as n from notifications where recipient_user_id = ${userId} and read_at is null and not is_test`);
  return r?.n ?? 0;
}

/** Marca como leídas las indicadas (o todas). */
export async function markRead(deps: Deps, userId: string, ids: string[] | 'all') {
  const now = deps.now().toISOString();
  await deps.db
    .update(t.notifications)
    .set({ readAt: now })
    .where(and(eq(t.notifications.recipientUserId, userId), isNull(t.notifications.readAt), ids === 'all' ? undefined : inArray(t.notifications.id, ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])));
}

/* ------------------------- Webhooks del proveedor -------------------------- */

const RANK: Record<string, number> = { queued: 0, scheduled: 0, failed: 0, suppressed: 0, sent: 1, delivered: 2, opened: 3, bounced: 4 };

/** Aplica un evento de entrega. Un rebote permanente o una queja de spam suprimen la dirección. */
export async function applyEmailEvent(deps: Deps, ev: EmailEvent) {
  const [d] = await deps.db.select().from(t.notificationDeliveries).where(and(eq(t.notificationDeliveries.providerMessageId, ev.messageId), eq(t.notificationDeliveries.channel, 'email')));
  const at = ev.at.toISOString();
  if (d) {
    const status = ev.type === 'spam_complaint' ? null : ev.type;
    const patch: Partial<typeof t.notificationDeliveries.$inferInsert> = {};
    if (ev.type === 'delivered') patch.deliveredAt = at;
    if (ev.type === 'opened') patch.openedAt = at;
    if (ev.type === 'bounced') {
      patch.bouncedAt = at;
      patch.error = ev.detail;
    }
    if (status && RANK[status]! > RANK[d.status]!) patch.status = status;
    if (Object.keys(patch).length) await deps.db.update(t.notificationDeliveries).set(patch).where(eq(t.notificationDeliveries.id, d.id));
  }
  if ((ev.type === 'bounced' && ev.permanent) || ev.type === 'spam_complaint') {
    const reason = ev.type === 'bounced' ? 'hard_bounce' : 'spam_complaint';
    await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'notifications.suppress' }, (tx) =>
      tx.insert(t.emailSuppressions).values({ email: ev.email, reason, detail: ev.type === 'bounced' ? ev.detail : null }).onConflictDoNothing(),
    );
  }
  return { matched: !!d };
}

/* ------------------------------- Back-office ------------------------------- */

export async function deliveryLog(deps: Deps, staffId: string, filter: { status?: string; channel?: string; q?: string; periodId?: string; limit?: number } = {}) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  const q = filter.q?.trim();
  return deps.db.execute<{ notification_id: string; channel: string; status: string; attempts: number; error: string | null; sent_at: string | null; delivered_at: string | null; opened_at: string | null; template: string; email: string | null; created_at: string }>(sql`
    select d.notification_id, d.channel, d.status, d.attempts, d.error, d.sent_at, d.delivered_at, d.opened_at, n.template, coalesce(u.email, n.recipient_email)::text as email, n.created_at
    from notification_deliveries d join notifications n on n.id = d.notification_id left join users u on u.id = n.recipient_user_id
    ${filter.periodId ? sql`join domain_events e on e.id = n.event_id join writer_statements ws on ws.id = e.aggregate_id and e.type = 'statement.published'` : sql``}
    where not n.is_test
      ${filter.status ? sql`and d.status = ${filter.status}::notif_status` : sql``}
      ${filter.channel ? sql`and d.channel = ${filter.channel}::notif_channel` : sql``}
      ${filter.periodId ? sql`and ws.period_id = ${filter.periodId}` : sql``}
      ${q ? sql`and (coalesce(u.email, n.recipient_email)::text ilike ${`%${q}%`} or n.template = ${q})` : sql``}
    order by n.created_at desc limit ${Math.min(filter.limit ?? 200, 500)}`);
}

/** Resumen por canal y estado. Con periodId, solo los avisos de statements de ese período. */
export async function deliveryStats(deps: Deps, staffId: string, opts: { periodId?: string; sinceDays?: number } = {}) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  const rows = await deps.db.execute<{ channel: string; status: string; n: number }>(sql`
    select d.channel, d.status, count(*)::int as n
    from notification_deliveries d join notifications n on n.id = d.notification_id
    ${opts.periodId ? sql`join domain_events e on e.id = n.event_id join writer_statements ws on ws.id = e.aggregate_id and e.type = 'statement.published'` : sql``}
    where not n.is_test
      ${opts.periodId ? sql`and ws.period_id = ${opts.periodId}` : sql`and n.created_at > now() - make_interval(days => ${opts.sinceDays ?? 30})`}
    group by d.channel, d.status`);
  const by: Record<string, Record<string, number>> = {};
  for (const r of rows) (by[r.channel] ??= {})[r.status] = r.n;
  return by;
}

export async function resendDelivery(deps: Deps, staffId: string, notificationId: string, channel: PrefChannel, ctx: RequestCtx) {
  const roles = await admin.staffRoles(deps, staffId);
  if (!roles.some((r) => r === 'operator' || r === 'super_admin')) throw new DomainError('FORBIDDEN');
  const [d] = await deps.db.select().from(t.notificationDeliveries).where(and(eq(t.notificationDeliveries.notificationId, notificationId), eq(t.notificationDeliveries.channel, channel)));
  if (!d) throw new DomainError('DELIVERY_NOT_FOUND');
  if (d.status !== 'failed' && d.status !== 'bounced') throw new DomainError('DELIVERY_NOT_FAILED');
  // Deja rastro en la auditoría de quién forzó el reenvío.
  await withSystem(deps.db, { actorId: staffId, actorRole: roles[0]!, command: 'notifications.resend', ...ctx }, (tx) =>
    tx.update(t.notificationDeliveries).set({ status: 'queued' }).where(eq(t.notificationDeliveries.id, d.id)),
  );
  return sendNotification(deps, notificationId, channel);
}

export async function listSuppressions(deps: Deps, staffId: string) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  return deps.db.select().from(t.emailSuppressions).orderBy(desc(t.emailSuppressions.createdAt)).limit(200);
}

export async function removeSuppression(deps: Deps, staffId: string, email: string, ctx: RequestCtx) {
  const roles = await admin.staffRoles(deps, staffId);
  if (!roles.some((r) => r === 'operator' || r === 'super_admin')) throw new DomainError('FORBIDDEN');
  await withSystem(deps.db, { actorId: staffId, actorRole: roles[0]!, command: 'notifications.unsuppress', ...ctx }, (tx) => tx.delete(t.emailSuppressions).where(eq(t.emailSuppressions.email, email)));
}

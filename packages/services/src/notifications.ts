import { eq, inArray, t, withSystem, sql } from '@pluma/db';
import { formatBps } from '@pluma/domain';
import { renderEmail, type TemplateData, type TemplateName } from '@pluma/emails';
import { guestSignToken } from './crypto';
import type { Deps } from './deps';
import { formatDate, formatMoney, intlLocale, type AppLocale } from './format';
import { loadPlans } from './membership';
import { sealAuthorship, partiesFor } from './works';
import { renderStatementFiles } from './statements';

type Event = typeof t.domainEvents.$inferSelect;

interface Outgoing<K extends TemplateName = TemplateName> {
  userId: string | null;
  email: string;
  locale: AppLocale;
  template: K;
  data: TemplateData[K];
  key: string;
}

const out = <K extends TemplateName>(o: Outgoing<K>): Outgoing => o as unknown as Outgoing;

async function userInfo(deps: Deps, userId: string) {
  const [u] = await deps.db
    .select({ email: t.users.email, locale: t.users.locale, country: t.writerProfiles.country, name: t.writerProfiles.legalName, artist: t.writerProfiles.artistName })
    .from(t.users)
    .leftJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.users.id))
    .where(eq(t.users.id, userId));
  return u ? { ...u, locale: u.locale as AppLocale, displayName: u.artist || u.name || u.email } : null;
}

async function versionContext(deps: Deps, versionId: string) {
  const [version] = await deps.db.select().from(t.splitVersions).where(eq(t.splitVersions.id, versionId));
  if (!version) return null;
  const [work] = await deps.db.select().from(t.works).where(eq(t.works.id, version.workId));
  const shares = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.splitVersionId, versionId));
  const parties = await deps.db.transaction((tx) => partiesFor(tx, shares));
  const creator = await userInfo(deps, work!.createdBy);
  return { version, work: work!, parties, creator: creator! };
}

const workUrl = (deps: Deps, workId: string) => `${deps.appUrl}/obras/${workId}`;

async function invitationMessages(deps: Deps, ev: Event, reminder: boolean): Promise<Outgoing[]> {
  const [share] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.id, ev.aggregateId));
  if (!share || share.status !== 'pending' || !share.invitedAt) return [];
  const ctx = await versionContext(deps, share.splitVersionId);
  if (!ctx || ctx.version.status !== 'pending_signatures') return [];
  const p = ctx.parties.find((x) => x.share.id === share.id)!;
  const locale = (p.locale ?? ctx.creator.locale) as AppLocale;
  const signUrl = share.writerUserId ? workUrl(deps, ctx.work.id) : `${deps.signUrl}/t/${guestSignToken(deps.signingSecret, share.id, new Date(share.invitedAt).toISOString())}`;
  const common = {
    inviterName: ctx.creator.displayName,
    workTitle: ctx.work.title,
    share: formatBps(share.shareBps, intlLocale(locale)),
    signUrl,
    expiresOn: share.signTokenExpiresAt ? formatDate(share.signTokenExpiresAt, locale) : '',
  };
  return reminder
    ? [out({ userId: share.writerUserId, email: p.email, locale, template: 'split_reminder', data: common, key: `split.reminder:${share.id}:${(ev.payload as { n?: string }).n ?? ev.id}` })]
    : [out({ userId: share.writerUserId, email: p.email, locale, template: 'split_invitation', data: { ...common, role: share.role, isMember: !!share.writerUserId }, key: `split.invitation:${share.id}:${share.invitedAt}` })];
}

/** Traduce cada evento de dominio en mensajes, en el idioma de cada destinatario. */
async function messagesFor(deps: Deps, ev: Event): Promise<Outgoing[]> {
  const payload = ev.payload as Record<string, unknown>;
  switch (ev.type) {
    case 'split.invitation':
      return invitationMessages(deps, ev, false);
    case 'split.reminder':
      return invitationMessages(deps, ev, true);
    case 'split.signed': {
      const ctx = await versionContext(deps, ev.aggregateId);
      if (!ctx || payload.signerName === ctx.creator.displayName) return [];
      return [out({ userId: ctx.work.createdBy, email: ctx.creator.email, locale: ctx.creator.locale, template: 'split_signed', data: { signerName: String(payload.signerName), workTitle: ctx.work.title, signed: Number(payload.signed), total: Number(payload.total), workUrl: workUrl(deps, ctx.work.id) }, key: `split.signed:${ev.id}` })];
    }
    case 'split.completed': {
      const ctx = await versionContext(deps, ev.aggregateId);
      if (!ctx) return [];
      return ctx.parties.map((p) =>
        out({ userId: p.share.writerUserId, email: p.email, locale: (p.locale ?? ctx.creator.locale) as AppLocale, template: 'split_completed', data: { workTitle: ctx.work.title, workUrl: p.share.writerUserId ? workUrl(deps, ctx.work.id) : deps.appUrl }, key: `split.completed:${ctx.version.id}:${p.share.id}` }),
      );
    }
    case 'split.rejected': {
      const ctx = await versionContext(deps, ev.aggregateId);
      if (!ctx) return [];
      return ctx.parties
        .filter((p) => p.share.writerUserId && p.share.status !== 'rejected')
        .map((p) => out({ userId: p.share.writerUserId, email: p.email, locale: (p.locale ?? 'es') as AppLocale, template: 'split_rejected', data: { signerName: String(payload.signerName), workTitle: ctx.work.title, reason: String(payload.reason), workUrl: workUrl(deps, ctx.work.id) }, key: `split.rejected:${ev.id}:${p.share.id}` }));
    }
    case 'work.status_changed': {
      const [work] = await deps.db.select().from(t.works).where(eq(t.works.id, ev.aggregateId));
      if (!work) return [];
      const members = await deps.db.execute<{ user_id: string }>(sql`
        select distinct ss.writer_user_id as user_id from split_versions sv join split_shares ss on ss.split_version_id = sv.id
        where sv.work_id = ${work.id} and ss.writer_user_id is not null and sv.status in ('signed', 'pending_signatures', 'rejected')`);
      const ids = new Set([work.createdBy, ...members.map((m) => m.user_id)]);
      const msgs: Outgoing[] = [];
      for (const id of ids) {
        const u = await userInfo(deps, id);
        if (u) msgs.push(out({ userId: id, email: u.email, locale: u.locale, template: 'work_status', data: { workTitle: work.title, status: String(payload.to), workUrl: workUrl(deps, work.id) }, key: `work.status:${ev.id}:${id}` }));
      }
      return msgs;
    }
    case 'work.conflict_detected': {
      const [work] = await deps.db.select().from(t.works).where(eq(t.works.id, ev.aggregateId));
      const u = work && (await userInfo(deps, work.createdBy));
      return u ? [out({ userId: work.createdBy, email: u.email, locale: u.locale, template: 'work_conflict', data: { workTitle: work.title, workUrl: workUrl(deps, work.id) }, key: `work.conflict:${ev.id}` })] : [];
    }
    case 'membership.activated':
    case 'membership.renewal_upcoming':
    case 'membership.payment_failed':
    case 'membership.suspended': {
      const u = await userInfo(deps, ev.aggregateId);
      const [m] = await deps.db.select().from(t.memberships).where(eq(t.memberships.userId, ev.aggregateId));
      if (!u || !m) return [];
      const plans = await loadPlans(deps);
      const plan = plans[m.planCode];
      const planName = m.planCode === 'pro' ? 'Pro' : u.locale === 'pt-BR' ? 'Sócio' : 'Socio';
      const manageUrl = `${deps.appUrl}/cuenta/plan`;
      const renewsOn = m.currentPeriodEnd ? formatDate(m.currentPeriodEnd, u.locale, u.country) : '';
      if (ev.type === 'membership.activated')
        return [out({ userId: ev.aggregateId, email: u.email, locale: u.locale, template: 'membership_activated', data: { plan: planName, amount: formatMoney(Number(payload.amountCents), String(payload.currency), u.locale, u.country), commission: formatBps(plan.commissionBps, intlLocale(u.locale, u.country)), renewsOn, appUrl: `${deps.appUrl}/obras/nueva` }, key: `membership.activated:${ev.id}` })];
      if (ev.type === 'membership.renewal_upcoming')
        return [out({ userId: ev.aggregateId, email: u.email, locale: u.locale, template: 'renewal_upcoming', data: { plan: planName, amount: formatMoney(plans[m.scheduledPlanCode ?? m.planCode].amountCents, 'USD', u.locale, u.country), renewsOn, manageUrl }, key: `renewal:${ev.aggregateId}:${String(payload.periodEnd)}` })];
      if (ev.type === 'membership.payment_failed')
        return [out({ userId: ev.aggregateId, email: u.email, locale: u.locale, template: 'payment_failed', data: { plan: planName, graceEndsOn: formatDate(String(payload.graceEndsAt), u.locale, u.country), manageUrl }, key: `payment_failed:${ev.id}` })];
      return [out({ userId: ev.aggregateId, email: u.email, locale: u.locale, template: 'membership_suspended', data: { manageUrl }, key: `suspended:${ev.id}` })];
    }
    case 'statement.published': {
      const v = await renderStatementFiles(deps, ev.aggregateId);
      if (!v) return [];
      const u = await userInfo(deps, v.writerUserId);
      if (!u) return [];
      const url = `${deps.appUrl}/pagos/${v.statementId}`;
      const key = `statement.published:${v.writerUserId}:${v.periodId}`;
      if (v.totals.netCents === 0 && v.totals.heldCents === 0 && v.byWork.length === 0) {
        return [out({ userId: v.writerUserId, email: u.email, locale: u.locale, template: 'statement_published_zero', data: { period: v.periodCode, statementUrl: url }, key })];
      }
      const top = v.byWork[0]?.title ?? '—';
      const H = {
        es: (n: number, w: number) => `Tus obras generaron ingresos en ${n} ${n === 1 ? 'territorio' : 'territorios'} y ${w} ${w === 1 ? 'obra' : 'obras'} este período.`,
        en: (n: number, w: number) => `Your songs earned in ${n} ${n === 1 ? 'territory' : 'territories'} across ${w} ${w === 1 ? 'song' : 'songs'} this period.`,
        'pt-BR': (n: number, w: number) => `Suas obras geraram receita em ${n} ${n === 1 ? 'território' : 'territórios'} e ${w} ${w === 1 ? 'obra' : 'obras'} neste período.`,
      };
      return [out({ userId: v.writerUserId, email: u.email, locale: u.locale, template: 'statement_published', data: { period: v.periodCode, net: formatMoney(v.totals.netCents, 'USD', u.locale, u.country), topWork: top, highlights: H[u.locale](v.byTerritory.length, v.byWork.length), statementUrl: url }, key })];
    }
    case 'payout.sent': {
      const [p] = await deps.db.select().from(t.payouts).where(eq(t.payouts.id, ev.aggregateId));
      const u = p && (await userInfo(deps, p.writerUserId));
      if (!p || !u) return [];
      const [m] = await deps.db.select({ label: t.payoutMethods.label }).from(t.payoutMethods).where(eq(t.payoutMethods.id, p.payoutMethodId));
      return [out({ userId: p.writerUserId, email: u.email, locale: u.locale, template: 'payout_sent', data: { amount: formatMoney(Number(p.amountCents), p.currency, u.locale, u.country), method: m?.label ?? '', paymentsUrl: `${deps.appUrl}/pagos` }, key: `payout.sent:${p.id}` })];
    }
    default:
      return [];
  }
}

/** Efectos de sistema de algunos eventos (no son correos). */
async function sideEffects(deps: Deps, ev: Event) {
  if (ev.type === 'work.authorship_changed') await sealAuthorship(deps, ev.aggregateId);
}

/**
 * Despacha el outbox: reclama eventos pendientes (seguro con varios workers), crea notificaciones
 * con clave de idempotencia (nunca dos veces lo mismo) y envía cada una por correo.
 */
export async function dispatchPending(deps: Deps, opts: { limit?: number } = {}) {
  const claimed = await deps.db.execute<{ id: string }>(sql`
    update domain_events set dispatched_at = now()
    where id in (select id from domain_events where dispatched_at is null order by occurred_at limit ${opts.limit ?? 50} for update skip locked)
    returning id`);
  if (!claimed.length) return { events: 0, sent: 0, failed: 0 };
  const events = await deps.db.select().from(t.domainEvents).where(inArray(t.domainEvents.id, claimed.map((c) => c.id))).orderBy(t.domainEvents.occurredAt);
  let sent = 0;
  let failed = 0;
  for (const ev of events) {
    try {
      await sideEffects(deps, ev);
    } catch (e) {
      console.error(`[eventos] efecto de ${ev.type} falló`, e);
    }
    for (const msg of await messagesFor(deps, ev)) {
      const ok = await deliver(deps, ev.id, msg);
      if (ok === true) sent++;
      else if (ok === false) failed++;
    }
  }
  return { events: events.length, sent, failed };
}

/** true = enviado, false = falló, null = ya se había enviado (idempotencia). */
async function deliver(deps: Deps, eventId: string, msg: Outgoing): Promise<boolean | null> {
  const [n] = await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'notification.create' }, (tx) =>
    tx
      .insert(t.notifications)
      .values({ eventId, recipientUserId: msg.userId, recipientEmail: msg.email, locale: msg.locale, template: msg.template, idempotencyKey: msg.key, data: msg.data as Record<string, unknown> })
      .onConflictDoNothing({ target: t.notifications.idempotencyKey })
      .returning({ id: t.notifications.id }),
  );
  if (!n) return null;
  return sendNotification(deps, n.id);
}

export async function sendNotification(deps: Deps, notificationId: string): Promise<boolean> {
  const [n] = await deps.db.select().from(t.notifications).where(eq(t.notifications.id, notificationId));
  if (!n) return false;
  const email = renderEmail(n.template as TemplateName, n.locale as AppLocale, n.data as never);
  try {
    const r = await deps.mail.send({ to: n.recipientEmail!, ...email, tag: n.template, idempotencyKey: n.idempotencyKey });
    await deps.db
      .insert(t.notificationDeliveries)
      .values({ notificationId: n.id, channel: 'email', status: 'sent', providerMessageId: r.providerMessageId, sentAt: deps.now().toISOString() })
      .onConflictDoUpdate({ target: [t.notificationDeliveries.notificationId, t.notificationDeliveries.channel], set: { status: 'sent', providerMessageId: r.providerMessageId, sentAt: deps.now().toISOString(), error: null } });
    return true;
  } catch (e) {
    await deps.db
      .insert(t.notificationDeliveries)
      .values({ notificationId: n.id, channel: 'email', status: 'failed', error: String((e as Error).message).slice(0, 500) })
      .onConflictDoUpdate({ target: [t.notificationDeliveries.notificationId, t.notificationDeliveries.channel], set: { status: 'failed', error: String((e as Error).message).slice(0, 500) } });
    return false;
  }
}

/** Reintenta los envíos fallidos (los llama el worker cada hora). */
export async function retryFailedDeliveries(deps: Deps) {
  const failed = await deps.db
    .select({ id: t.notificationDeliveries.notificationId })
    .from(t.notificationDeliveries)
    .where(eq(t.notificationDeliveries.status, 'failed'))
    .limit(100);
  let ok = 0;
  for (const f of failed) if (await sendNotification(deps, f.id)) ok++;
  return { retried: failed.length, ok };
}

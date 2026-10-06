import { and, eq, inArray, lt, t, withSystem, sql } from '@pluma/db';
import { formatBps } from '@pluma/domain';
import { MANDATORY_EMAIL, TEMPLATE_CATEGORY, renderEmail, renderPush, whatsappTemplate, type NotificationCategory, type TemplateData, type TemplateName } from '@pluma/emails';
import { guestSignToken } from './crypto';
import type { Deps } from './deps';
import { formatDate, formatMoney, intlLocale, type AppLocale } from './format';
import { loadPlans } from './membership';
import { sealAuthorship, partiesFor } from './works';
import { renderStatementFiles } from './statements';
import { teamEmail } from './leads';

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
    .select({ id: t.users.id, email: t.users.email, locale: t.users.locale, country: t.writerProfiles.country, name: t.writerProfiles.legalName, artist: t.writerProfiles.artistName })
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
    case 'royalties.unclaimed_detected': {
      const u = await userInfo(deps, ev.aggregateId);
      if (!u) return [];
      const titles = (payload.titles as string[]) ?? [];
      return [out({ userId: ev.aggregateId, email: u.email, locale: u.locale, template: 'royalties_unclaimed', data: { count: Number(payload.count), works: titles.slice(0, 3).map((x) => `“${x}”`).join(', '), paymentsUrl: `${deps.appUrl}/obras` }, key: `royalties.unclaimed:${ev.aggregateId}:${String(payload.periodId)}` })];
    }
    case 'application.submitted':
    case 'application.reminder':
    case 'application.expired':
    case 'application.declined': {
      const [a] = await deps.db.select().from(t.applications).where(eq(t.applications.id, ev.aggregateId));
      if (!a) return [];
      const [r] = await deps.db.select().from(t.networkRequests).where(eq(t.networkRequests.id, a.requestId));
      const owner = await userInfo(deps, r!.authorUserId);
      const applicant = await userInfo(deps, a.applicantUserId);
      if (!owner || !applicant) return [];
      const requestUrl = `${deps.appUrl}/red/${r!.id}`;
      const boardUrl = `${deps.appUrl}/red`;
      if (ev.type === 'application.submitted') {
        const { publicCard } = await import('./profiles');
        const card = await publicCard(deps, a.applicantUserId);
        const lang = (l: AppLocale) => new Intl.DisplayNames([intlLocale(l)], { type: 'language' });
        const since = (l: AppLocale) => (card.history.memberSince ? new Intl.DateTimeFormat(intlLocale(l), { month: 'short', year: 'numeric' }).format(new Date(card.history.memberSince)) : '');
        const HIST = {
          es: (l: AppLocale) => `Desde ${since(l)} · ${card.history.registeredWorks} ${card.history.registeredWorks === 1 ? 'obra registrada' : 'obras registradas'} · ${card.history.collaborations} ${card.history.collaborations === 1 ? 'colaboración' : 'colaboraciones'}`,
          en: (l: AppLocale) => `Since ${since(l)} · ${card.history.registeredWorks} registered ${card.history.registeredWorks === 1 ? 'song' : 'songs'} · ${card.history.collaborations} ${card.history.collaborations === 1 ? 'collaboration' : 'collaborations'}`,
          'pt-BR': (l: AppLocale) => `Desde ${since(l)} · ${card.history.registeredWorks} ${card.history.registeredWorks === 1 ? 'obra registrada' : 'obras registradas'} · ${card.history.collaborations} ${card.history.collaborations === 1 ? 'colaboração' : 'colaborações'}`,
        };
        const L = owner.locale;
        const credits = card.credits.map((c) => `${c.title}${c.artist ? ` — ${c.artist}` : ''}${c.dspUrl ? ` (${c.dspUrl})` : ''}`).join(' · ');
        return [
          out({ userId: owner.id, email: owner.email, locale: L, template: 'application_received', data: { applicantName: card.name, role: card.mainRole ?? '', city: [card.city, card.country].filter(Boolean).join(', '), languages: card.languages.map((x) => lang(L).of(x) ?? x).join(', '), credits, history: HIST[L](L), message: a.message, share: formatBps(a.acceptedShareBps, intlLocale(L)), requestTitle: r!.title, requestUrl, profileUrl: `${deps.appUrl}/perfil/${a.applicantUserId}` }, key: `application.received:${a.id}` }),
          out({ userId: applicant.id, email: applicant.email, locale: applicant.locale, template: 'application_sent', data: { requestTitle: r!.title, ownerName: owner.displayName, expiresOn: formatDate(a.expiresAt, applicant.locale, applicant.country), applicationsUrl: `${deps.appUrl}/red/postulaciones` }, key: `application.sent:${a.id}` }),
        ];
      }
      if (ev.type === 'application.reminder')
        return [out({ userId: owner.id, email: owner.email, locale: owner.locale, template: 'application_reminder', data: { applicantName: applicant.displayName, requestTitle: r!.title, expiresOn: formatDate(a.expiresAt, owner.locale, owner.country), requestUrl }, key: `application.reminder:${a.id}` })];
      if (ev.type === 'application.expired')
        return [out({ userId: applicant.id, email: applicant.email, locale: applicant.locale, template: 'application_expired', data: { requestTitle: r!.title, boardUrl }, key: `application.expired:${a.id}` })];
      return [out({ userId: applicant.id, email: applicant.email, locale: applicant.locale, template: 'application_declined', data: { requestTitle: r!.title, filled: !!payload.filled, boardUrl }, key: `application.declined:${a.id}` })];
    }
    case 'application.accepted': {
      const { getCollaboration } = await import('./network');
      const [c] = await deps.db.select().from(t.collaborations).where(eq(t.collaborations.id, ev.aggregateId));
      if (!c) return [];
      const shares = c.preAgreedShares as { user_id: string }[];
      const msgs: Outgoing[] = [];
      for (const s of shares) {
        const me = await userInfo(deps, s.user_id);
        const view = await getCollaboration(deps, s.user_id, c.id);
        const other = view?.parties.find((p) => !p.isMe);
        const mine = view?.parties.find((p) => p.isMe);
        if (!me || !view || !other || !mine) continue;
        msgs.push(out({ userId: s.user_id, email: me.email, locale: me.locale, template: 'application_accepted', data: { otherName: other.name, otherEmail: other.email, otherPhone: other.phone ?? '', requestTitle: view.requestTitle, myShare: formatBps(mine.shareBps, intlLocale(me.locale)), otherShare: formatBps(other.shareBps, intlLocale(me.locale)), sessionUrl: view.sessionUrl ?? '', collaborationUrl: `${deps.appUrl}/red/colaboraciones/${c.id}` }, key: `application.accepted:${c.id}:${s.user_id}` }));
      }
      return msgs;
    }
    case 'ar.invited': {
      const [inv] = await deps.db.select().from(t.arInvitations).where(eq(t.arInvitations.id, ev.aggregateId));
      if (!inv) return [];
      const { arInviteUrl } = await import('./catalog');
      return [out({ userId: null, email: inv.email, locale: 'es', template: 'ar_invitation', data: { company: inv.company, inviteUrl: arInviteUrl(deps, inv.id), expiresOn: formatDate(inv.expiresAt, 'es') }, key: `ar.invited:${inv.id}` })];
    }
    case 'ar.interest': {
      const [i] = await deps.db.select().from(t.arInterests).where(eq(t.arInterests.id, ev.aggregateId));
      if (!i) return [];
      const [w] = await deps.db.select({ title: t.works.title }).from(t.works).where(eq(t.works.id, i.workId));
      const { arCompany } = await import('./catalog');
      const company = (await arCompany(deps, i.arUserId)) ?? 'A&R';
      const writers = await catalogWriters(deps, i.workId);
      return writers.map((u) => out({ userId: u.id, email: u.email, locale: u.locale, template: 'ar_interest', data: { company, workTitle: w!.title, message: i.message ?? '', workUrl: workUrl(deps, i.workId) }, key: `ar.interest:${i.id}:${u.id}` }));
    }
    case 'hold.requested':
    case 'hold.decided': {
      const [h] = await deps.db.select().from(t.holds).where(eq(t.holds.id, ev.aggregateId));
      if (!h) return [];
      const [w] = await deps.db.select({ title: t.works.title, owner: t.works.createdBy }).from(t.works).where(eq(t.works.id, h.workId));
      if (ev.type === 'hold.requested') {
        const owner = await userInfo(deps, w!.owner);
        const { arCompany } = await import('./catalog');
        return owner ? [out({ userId: owner.id, email: owner.email, locale: owner.locale, template: 'hold_requested', data: { company: (await arCompany(deps, h.requesterUserId)) ?? 'A&R', workTitle: w!.title, days: h.durationDays, message: h.message ?? '', holdsUrl: `${deps.appUrl}/sync/holds` }, key: `hold.requested:${h.id}` })] : [];
      }
      const ar = await userInfo(deps, h.requesterUserId);
      return ar ? [out({ userId: ar.id, email: ar.email, locale: ar.locale, template: 'hold_decided', data: { workTitle: w!.title, approved: h.status === 'active', endsOn: h.endsAt ? formatDate(h.endsAt, ar.locale) : '', portalUrl: `${deps.appUrl}/ar/actividad` }, key: `hold.decided:${h.id}` })] : [];
    }
    case 'license.requested':
    case 'license.decided': {
      const [r] = await deps.db.select().from(t.licenseRequests).where(eq(t.licenseRequests.id, ev.aggregateId));
      if (!r) return [];
      const [w] = await deps.db.select({ title: t.works.title }).from(t.works).where(eq(t.works.id, r.workId));
      if (ev.type === 'license.requested') {
        const approvals = await deps.db.select({ id: t.licenseApprovals.writerUserId }).from(t.licenseApprovals).where(eq(t.licenseApprovals.licenseRequestId, r.id));
        const msgs: Outgoing[] = [];
        for (const a of approvals) {
          const u = await userInfo(deps, a.id);
          if (!u) continue;
          const L = u.locale;
          msgs.push(out({ userId: u.id, email: u.email, locale: L, template: 'license_requested', data: { company: r.buyerCompany ?? 'Pluma Sync', workTitle: w!.title, usage: USAGE[L][r.usage] ?? r.usage, territory: TERRITORY[L][r.territory] ?? r.territory, term: TERM[L](r.termMonths), quote: `${formatMoney(Number(r.quoteMinCents), 'USD', L)} – ${formatMoney(Number(r.quoteMaxCents), 'USD', L)}`, project: r.projectDescription, licensesUrl: `${deps.appUrl}/sync/licencias` }, key: `license.requested:${r.id}:${u.id}` }));
        }
        return msgs;
      }
      const status = String(payload.status);
      const recipients = new Map<string, string>([[r.buyerUserId, `${deps.appUrl}/pluma-sync/solicitudes`]]);
      if (status === 'issued' || status === 'canceled' || status === 'writers_rejected') {
        for (const a of await deps.db.select({ id: t.licenseApprovals.writerUserId }).from(t.licenseApprovals).where(eq(t.licenseApprovals.licenseRequestId, r.id))) recipients.set(a.id, `${deps.appUrl}/sync/licencias`);
      }
      const msgs: Outgoing[] = [];
      for (const [id, url] of recipients) {
        const u = await userInfo(deps, id);
        if (!u) continue;
        msgs.push(out({ userId: u.id, email: u.email, locale: u.locale, template: 'license_update', data: { workTitle: w!.title, status: LSTATUS[u.locale][status] ?? status, fee: status === 'issued' && r.finalFeeCents ? formatMoney(Number(r.finalFeeCents), 'USD', u.locale) : '', requestsUrl: url }, key: `license.${status}:${r.id}:${id}` }));
      }
      return msgs;
    }
    case 'lead.created': {
      const to = teamEmail();
      const [l] = await deps.db.select().from(t.marketingLeads).where(eq(t.marketingLeads.id, ev.aggregateId));
      if (!to || !l) return [];
      const KIND: Record<string, string> = { waitlist: 'lista de espera', sync: 'comprador de sync', ar: 'A&R' };
      const details: [string, string][] = [
        ['Nombre', l.name],
        ['Empresa', l.company],
        ['Cargo', l.role],
        ['Plan', l.plan],
        ['Idioma', l.lang],
      ].filter((x): x is [string, string] => !!x[1]);
      const adminUrl = `${(process.env.PLUMA_ADMIN_URL || deps.appUrl).replace(/\/$/, '')}/contactos`;
      return [out({ userId: null, email: to, locale: 'es', template: 'lead_received', data: { kind: KIND[l.kind] ?? l.kind, email: l.email, details, message: l.message ?? '', adminUrl }, key: `lead.created:${l.id}` })];
    }
    default:
      return [];
  }
}

/** Autores socios del split firmado vigente (reciben avisos del catálogo). */
async function catalogWriters(deps: Deps, workId: string) {
  const rows = await deps.db.execute<{ user_id: string }>(sql`
    select distinct ss.writer_user_id as user_id from split_versions sv join split_shares ss on ss.split_version_id = sv.id
    where sv.work_id = ${workId} and sv.status = 'signed' and ss.writer_user_id is not null`);
  const out: NonNullable<Awaited<ReturnType<typeof userInfo>>>[] = [];
  for (const r of rows) {
    const u = await userInfo(deps, r.user_id);
    if (u) out.push(u);
  }
  return out;
}

const USAGE: Record<AppLocale, Record<string, string>> = {
  es: { social_media: 'Redes sociales', digital_ads: 'Publicidad digital', tv_film: 'TV y cine', videogame: 'Videojuego', other: 'Otro' },
  en: { social_media: 'Social media', digital_ads: 'Digital ads', tv_film: 'TV & film', videogame: 'Video game', other: 'Other' },
  'pt-BR': { social_media: 'Redes sociais', digital_ads: 'Publicidade digital', tv_film: 'TV e cinema', videogame: 'Videogame', other: 'Outro' },
};
const TERRITORY: Record<AppLocale, Record<string, string>> = {
  es: { LATAM: 'Latinoamérica', US: 'Estados Unidos', WORLD: 'Mundial' },
  en: { LATAM: 'Latin America', US: 'United States', WORLD: 'Worldwide' },
  'pt-BR': { LATAM: 'América Latina', US: 'Estados Unidos', WORLD: 'Mundial' },
};
const TERM: Record<AppLocale, (m: number) => string> = { es: (m) => `${m} meses`, en: (m) => `${m} months`, 'pt-BR': (m) => `${m} meses` };
const LSTATUS: Record<AppLocale, Record<string, string>> = {
  es: { writers_approved: 'aprobada por los autores', writers_rejected: 'rechazada por los autores', negotiating: 'en negociación', issued: 'emitida', canceled: 'cancelada' },
  en: { writers_approved: 'approved by the writers', writers_rejected: 'declined by the writers', negotiating: 'in negotiation', issued: 'issued', canceled: 'canceled' },
  'pt-BR': { writers_approved: 'aprovada pelos autores', writers_rejected: 'recusada pelos autores', negotiating: 'em negociação', issued: 'emitida', canceled: 'cancelada' },
};

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
      .values({ eventId, recipientUserId: msg.userId, recipientEmail: msg.email, locale: msg.locale, template: msg.template, category: TEMPLATE_CATEGORY[msg.template], idempotencyKey: msg.key, data: msg.data as Record<string, unknown> })
      .onConflictDoNothing({ target: t.notifications.idempotencyKey })
      .returning({ id: t.notifications.id }),
  );
  if (!n) return null;
  return sendNotification(deps, n.id);
}

type Channel = 'email' | 'push' | 'whatsapp';
type Notification = typeof t.notifications.$inferSelect;

/**
 * Canales de una notificación. El centro in-app siempre la muestra (es la fila misma).
 * Correo: obligatorio para dinero, splits y membresía; lo demás según preferencia.
 * Push y WhatsApp: opcionales; WhatsApp solo con número y consentimiento, y solo para plantillas aprobadas.
 */
export async function channelsFor(deps: Deps, n: Notification): Promise<Channel[]> {
  if (!n.recipientUserId) return ['email']; // coautor invitado sin cuenta
  const category = n.category as NotificationCategory;
  const prefs = await deps.db.select().from(t.notificationPreferences).where(and(eq(t.notificationPreferences.userId, n.recipientUserId), eq(t.notificationPreferences.category, category)));
  const on = (c: Channel) => prefs.find((p) => p.channel === c)?.enabled ?? defaultPreference(category, c);
  const channels: Channel[] = [];
  if (MANDATORY_EMAIL.includes(category) || on('email')) channels.push('email');
  if (on('push')) {
    const [sub] = await deps.db.select({ id: t.pushSubscriptions.id }).from(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, n.recipientUserId)).limit(1);
    if (sub) channels.push('push');
  }
  if (deps.whatsapp && on('whatsapp') && whatsappTemplate(n.template as TemplateName, n.locale as AppLocale, n.data as never)) {
    const [u] = await deps.db.select({ phone: t.users.phoneE164, optIn: t.users.whatsappOptInAt }).from(t.users).where(eq(t.users.id, n.recipientUserId));
    if (u?.phone && u.optIn) channels.push('whatsapp');
  }
  return channels;
}

/** Sin preferencia guardada: correo y push encendidos; WhatsApp solo para dinero. */
export function defaultPreference(category: NotificationCategory, channel: Channel): boolean {
  if (channel === 'whatsapp') return category === 'money';
  return true;
}

async function recordDelivery(deps: Deps, notificationId: string, channel: Channel, r: { status: 'sent' | 'failed' | 'suppressed'; providerMessageId?: string | null; error?: string | null }) {
  const now = deps.now().toISOString();
  const values = { status: r.status, providerMessageId: r.providerMessageId ?? null, sentAt: r.status === 'sent' ? now : null, error: r.error?.slice(0, 500) ?? null };
  await deps.db
    .insert(t.notificationDeliveries)
    .values({ notificationId, channel, attempts: 1, ...values })
    .onConflictDoUpdate({ target: [t.notificationDeliveries.notificationId, t.notificationDeliveries.channel], set: { ...values, attempts: sql`${t.notificationDeliveries.attempts} + 1` } });
}

async function sendEmail(deps: Deps, n: Notification) {
  const [suppressed] = await deps.db.select().from(t.emailSuppressions).where(eq(t.emailSuppressions.email, n.recipientEmail!));
  if (suppressed) return recordDelivery(deps, n.id, 'email', { status: 'suppressed', error: suppressed.reason }).then(() => true);
  const email = renderEmail(n.template as TemplateName, n.locale as AppLocale, n.data as never);
  try {
    const r = await deps.mail.send({ to: n.recipientEmail!, ...email, tag: n.template, idempotencyKey: n.idempotencyKey });
    await recordDelivery(deps, n.id, 'email', { status: 'sent', providerMessageId: r.providerMessageId });
    return true;
  } catch (e) {
    await recordDelivery(deps, n.id, 'email', { status: 'failed', error: String((e as Error).message) });
    return false;
  }
}

async function sendPush(deps: Deps, n: Notification) {
  const subs = await deps.db.select().from(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, n.recipientUserId!));
  const msg = renderPush(n.template as TemplateName, n.locale as AppLocale, n.data as never);
  let ok = 0;
  let lastError = '';
  for (const s of subs) {
    const r = await deps.push.send({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, { ...msg, tag: n.idempotencyKey });
    if (r.ok) ok++;
    else {
      lastError = r.error;
      if (r.gone) await deps.db.delete(t.pushSubscriptions).where(eq(t.pushSubscriptions.id, s.id));
    }
  }
  // Un dispositivo que ya no existe no es un fallo que valga reintentar.
  const allGone = ok === 0 && !(await deps.db.select({ id: t.pushSubscriptions.id }).from(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, n.recipientUserId!)).limit(1)).length;
  await recordDelivery(deps, n.id, 'push', ok > 0 ? { status: 'sent' } : allGone ? { status: 'suppressed', error: 'sin dispositivos' } : { status: 'failed', error: lastError });
  return ok > 0 || allGone;
}

async function sendWhatsApp(deps: Deps, n: Notification) {
  const tpl = whatsappTemplate(n.template as TemplateName, n.locale as AppLocale, n.data as never);
  const [u] = await deps.db.select({ phone: t.users.phoneE164, optIn: t.users.whatsappOptInAt }).from(t.users).where(eq(t.users.id, n.recipientUserId!));
  if (!deps.whatsapp || !tpl || !u?.phone || !u.optIn) return recordDelivery(deps, n.id, 'whatsapp', { status: 'suppressed', error: 'sin consentimiento' }).then(() => true);
  try {
    const r = await deps.whatsapp.send({ to: u.phone, ...tpl });
    await recordDelivery(deps, n.id, 'whatsapp', { status: 'sent', providerMessageId: r.providerMessageId });
    return true;
  } catch (e) {
    await recordDelivery(deps, n.id, 'whatsapp', { status: 'failed', error: String((e as Error).message) });
    return false;
  }
}

const SENDERS: Record<Channel, (deps: Deps, n: Notification) => Promise<boolean>> = { email: sendEmail, push: sendPush, whatsapp: sendWhatsApp };

/** Envía una notificación por sus canales (o solo por uno, al reintentar). true si todos salieron. */
export async function sendNotification(deps: Deps, notificationId: string, only?: Channel): Promise<boolean> {
  const [n] = await deps.db.select().from(t.notifications).where(eq(t.notifications.id, notificationId));
  if (!n) return false;
  const channels = only ? [only] : await channelsFor(deps, n);
  let all = true;
  for (const c of channels) if (!(await SENDERS[c](deps, n))) all = false;
  return all;
}

/** Reintenta los envíos fallidos (los llama el worker cada hora), hasta 5 intentos por canal. */
export async function retryFailedDeliveries(deps: Deps) {
  const failed = await deps.db
    .select({ id: t.notificationDeliveries.notificationId, channel: t.notificationDeliveries.channel })
    .from(t.notificationDeliveries)
    .where(and(eq(t.notificationDeliveries.status, 'failed'), lt(t.notificationDeliveries.attempts, 5)))
    .limit(100);
  let ok = 0;
  for (const f of failed) if (await sendNotification(deps, f.id, f.channel as Channel)) ok++;
  return { retried: failed.length, ok };
}

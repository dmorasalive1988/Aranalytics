import { and, desc, eq, isNull, t, withSystem, sql } from '@pluma/db';
import { DomainError, WRITER_ROLES, isMinor, type WriterRole } from '@pluma/domain';
import * as admin from './admin';
import type { Deps, RequestCtx } from './deps';
import { assertNetworkMember } from './network';

export interface Credit {
  id: string | null;
  title: string;
  artist: string | null;
  role: string;
  dspUrl: string | null;
  source: 'pluma_registry' | 'operator';
  strength: number;
}

const DSP_KEYS = ['spotify', 'apple', 'youtube', 'deezer', 'tidal', 'soundcloud'] as const;
export type DspLinks = Partial<Record<(typeof DSP_KEYS)[number], string>>;

/**
 * Créditos verificados: las obras con split firmado en Pluma (fuente: registro de Pluma) y los créditos
 * declarados que verificó un operador. Los más fuertes primero (registrada > enviada > firmada).
 */
export async function verifiedCredits(deps: Deps, userId: string, limit = 5): Promise<Credit[]> {
  const pluma = await deps.db.execute<{ title: string; role: string; status: string }>(sql`
    select distinct on (w.id) w.title, ss.role::text as role, w.status::text as status
    from works w join split_versions sv on sv.work_id = w.id and sv.status = 'signed'
    join split_shares ss on ss.split_version_id = sv.id and ss.writer_user_id = ${userId}
    where w.status in ('splits_signed', 'sent_to_publisher', 'registered')
    order by w.id, sv.version desc`);
  const manual = await deps.db.select().from(t.credits).where(and(eq(t.credits.userId, userId), eq(t.credits.verified, true)));
  const strength = { registered: 3, sent_to_publisher: 2, splits_signed: 1 } as Record<string, number>;
  const all: Credit[] = [
    ...pluma.map((p) => ({ id: null, title: p.title, artist: null, role: p.role, dspUrl: null, source: 'pluma_registry' as const, strength: strength[p.status] ?? 1 })),
    ...manual.map((m) => ({ id: m.id, title: m.title, artist: m.artist, role: m.role, dspUrl: m.dspUrl, source: 'operator' as const, strength: 2 + (m.dspUrl ? 1 : 0) + m.strength })),
  ];
  return all.sort((a, b) => b.strength - a.strength || a.title.localeCompare(b.title)).slice(0, limit);
}

/** Tarjeta pública (postulaciones, autor de una solicitud). Nunca incluye correo ni teléfono. */
export async function publicCard(deps: Deps, userId: string) {
  const [p] = await deps.db
    .select({ artist: t.writerProfiles.artistName, legal: t.writerProfiles.legalName, city: t.writerProfiles.city, country: t.writerProfiles.country, langs: t.writerProfiles.spokenLanguages, role: t.writerProfiles.mainRole, bio: t.writerProfiles.bio, dsp: t.writerProfiles.dspLinks, since: t.writerProfiles.createdAt, plan: t.memberships.planCode, status: t.memberships.status })
    .from(t.writerProfiles)
    .leftJoin(t.memberships, eq(t.memberships.userId, t.writerProfiles.userId))
    .where(eq(t.writerProfiles.userId, userId));
  const [h] = await deps.db.execute<{ works: number; collabs: number }>(sql`
    select (select count(distinct w.id)::int from works w join split_versions sv on sv.work_id = w.id and sv.status = 'signed'
              join split_shares ss on ss.split_version_id = sv.id and ss.writer_user_id = ${userId}
            where w.status in ('sent_to_publisher', 'registered')) as works,
           (select count(*)::int from collaborations c where c.pre_agreed_shares @> ${JSON.stringify([{ user_id: userId }])}::jsonb) as collabs`);
  return {
    userId,
    name: p?.artist || p?.legal || '—',
    city: p?.city ?? null,
    country: p?.country ?? null,
    languages: p?.langs ?? [],
    mainRole: (p?.role ?? null) as WriterRole | null,
    bio: p?.bio ?? null,
    dspLinks: (p?.dsp ?? {}) as DspLinks,
    featured: p?.plan === 'pro' && (p.status === 'active' || p.status === 'past_due'),
    credits: await verifiedCredits(deps, userId),
    history: { memberSince: p?.since ?? '', registeredWorks: h?.works ?? 0, collaborations: h?.collabs ?? 0 },
  };
}

/** Perfil público completo (A41): solo para miembros de la red; los menores no se muestran. */
export async function publicProfile(deps: Deps, viewerId: string, userId: string) {
  if (viewerId !== userId) await assertNetworkMember(deps, viewerId);
  const [p] = await deps.db.select({ birth: t.writerProfiles.birthDate, country: t.writerProfiles.country, visible: t.writerProfiles.networkVisible }).from(t.writerProfiles).where(eq(t.writerProfiles.userId, userId));
  if (!p || (viewerId !== userId && (isMinor(p.birth, p.country, deps.now()) || !p.visible))) return null;
  const card = await publicCard(deps, userId);
  const credits = await verifiedCredits(deps, userId, 50);
  const requests = await deps.db
    .select({ id: t.networkRequests.id, title: t.networkRequests.title, type: t.networkRequests.type })
    .from(t.networkRequests)
    .where(and(eq(t.networkRequests.authorUserId, userId), eq(t.networkRequests.status, 'open'), isNull(t.networkRequests.hiddenAt)))
    .orderBy(desc(t.networkRequests.createdAt))
    .limit(10);
  return { ...card, credits, openRequests: requests };
}

/* ----------------------------- Editar perfil (A42) ----------------------------- */

function cleanUrl(v: string | undefined | null): string | null {
  const s = v?.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new DomainError('URL_INVALID');
  }
  if (u.protocol !== 'https:') throw new DomainError('URL_INVALID');
  return u.toString();
}

export async function updateNetworkProfile(deps: Deps, userId: string, input: { bio: string; languages: string[]; mainRole: string | null; dspLinks: DspLinks }, ctx: RequestCtx) {
  const bio = input.bio.trim();
  if (bio.length > 600) throw new DomainError('BIO_TOO_LONG');
  if (input.mainRole && !WRITER_ROLES.includes(input.mainRole as WriterRole)) throw new DomainError('ROLE_INVALID');
  const languages = [...new Set(input.languages.map((l) => l.trim().toLowerCase()).filter((l) => /^[a-z]{2}$/.test(l)))].slice(0, 8);
  const dsp: Record<string, string> = {};
  for (const k of DSP_KEYS) {
    const v = cleanUrl(input.dspLinks[k]);
    if (v) dsp[k] = v;
  }
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'profile.update_network', ...ctx }, (tx) =>
    tx
      .update(t.writerProfiles)
      .set({ bio: bio || null, spokenLanguages: sql`${`{${languages.join(',')}}`}::text[]` as unknown as string[], mainRole: (input.mainRole || null) as WriterRole | null, dspLinks: dsp })
      .where(eq(t.writerProfiles.userId, userId)),
  );
}

/** Créditos declarados: quedan pendientes hasta que un operador los verifica. */
export async function addCredit(deps: Deps, userId: string, input: { title: string; artist: string; role: string; dspUrl: string }, ctx: RequestCtx) {
  const title = input.title.trim();
  const role = input.role.trim();
  if (title.length < 1 || title.length > 200 || role.length < 2 || role.length > 60) throw new DomainError('CREDIT_INVALID');
  const pending = await deps.db.select({ id: t.credits.id }).from(t.credits).where(and(eq(t.credits.userId, userId), eq(t.credits.verified, false), isNull(t.credits.reviewedAt)));
  if (pending.length >= 20) throw new DomainError('CREDIT_LIMIT');
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'profile.add_credit', ...ctx }, (tx) =>
    tx.insert(t.credits).values({ userId, title, artist: input.artist.trim() || null, role, dspUrl: cleanUrl(input.dspUrl), verified: false }),
  );
}

export async function deleteCredit(deps: Deps, userId: string, creditId: string, ctx: RequestCtx) {
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'profile.delete_credit', ...ctx }, (tx) => tx.delete(t.credits).where(and(eq(t.credits.id, creditId), eq(t.credits.userId, userId))));
}

export async function myProfile(deps: Deps, userId: string) {
  const [p] = await deps.db.select().from(t.writerProfiles).where(eq(t.writerProfiles.userId, userId));
  const credits = await deps.db.select().from(t.credits).where(eq(t.credits.userId, userId)).orderBy(desc(t.credits.createdAt));
  return { bio: p?.bio ?? '', languages: p?.spokenLanguages ?? [], mainRole: (p?.mainRole ?? null) as WriterRole | null, dspLinks: (p?.dspLinks ?? {}) as DspLinks, credits, pluma: await verifiedCredits(deps, userId, 50).then((c) => c.filter((x) => x.source === 'pluma_registry')) };
}

/* ------------------------- Back-office: moderación (E16) ------------------------- */

async function requireOperator(deps: Deps, staffId: string) {
  const roles = await admin.staffRoles(deps, staffId);
  const role = roles.find((r) => r === 'operator' || r === 'super_admin');
  if (!role) throw new DomainError('FORBIDDEN');
  return role;
}

export async function listRequestsAdmin(deps: Deps, staffId: string, f: { q?: string; hidden?: boolean } = {}) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  const q = f.q?.trim();
  return deps.db.execute<{ id: string; title: string; type: string; status: string; author: string; created_at: string; hidden_at: string | null; hidden_reason: string | null; applications: number; description: string }>(sql`
    select r.id, r.title, r.type, r.status, coalesce(wp.artist_name, wp.legal_name) as author, r.created_at, r.hidden_at, r.hidden_reason, r.description,
           (select count(*)::int from applications a where a.request_id = r.id) as applications
    from network_requests r join writer_profiles wp on wp.user_id = r.author_user_id
    where true ${f.hidden ? sql`and r.hidden_at is not null` : sql``}
      ${q ? sql`and (r.title ilike ${`%${q}%`} or r.description ilike ${`%${q}%`} or wp.artist_name ilike ${`%${q}%`} or wp.legal_name ilike ${`%${q}%`})` : sql``}
    order by r.created_at desc limit 200`);
}

export async function setRequestHidden(deps: Deps, staffId: string, requestId: string, hidden: boolean, reason: string, ctx: RequestCtx) {
  const role = await requireOperator(deps, staffId);
  if (hidden && reason.trim().length < 5) throw new DomainError('REASON_REQUIRED');
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: hidden ? 'network.hide' : 'network.unhide', ...ctx }, (tx) =>
    tx
      .update(t.networkRequests)
      .set(hidden ? { hiddenAt: deps.now().toISOString(), hiddenReason: reason.trim(), hiddenBy: staffId } : { hiddenAt: null, hiddenReason: null, hiddenBy: null })
      .where(eq(t.networkRequests.id, requestId)),
  );
}

export async function pendingCredits(deps: Deps, staffId: string) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  return deps.db.execute<{ id: string; title: string; artist: string | null; role: string; dsp_url: string | null; created_at: string; user_id: string; author: string }>(sql`
    select c.id, c.title, c.artist, c.role, c.dsp_url, c.created_at, c.user_id, coalesce(wp.artist_name, wp.legal_name) as author
    from credits c join writer_profiles wp on wp.user_id = c.user_id
    where not c.verified and c.reviewed_at is null order by c.created_at limit 200`);
}

export async function reviewCredit(deps: Deps, staffId: string, creditId: string, approve: boolean, reason: string, ctx: RequestCtx) {
  const role = await requireOperator(deps, staffId);
  if (!approve && reason.trim().length < 5) throw new DomainError('REASON_REQUIRED');
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: approve ? 'credit.verify' : 'credit.reject', ...ctx }, (tx) =>
    tx
      .update(t.credits)
      .set({ verified: approve, verifiedSource: approve ? 'operator' : null, reviewedBy: staffId, reviewedAt: deps.now().toISOString(), rejectedReason: approve ? null : reason.trim() })
      .where(eq(t.credits.id, creditId)),
  );
}

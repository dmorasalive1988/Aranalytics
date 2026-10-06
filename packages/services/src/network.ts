import { and, desc, eq, inArray, t, withSystem, sql, type Tx } from '@pluma/db';
import {
  DEFAULT_PLANS,
  DomainError,
  applicationExpiry,
  applicationTimer,
  canUseFeature,
  isMinor,
  preAgreedShares,
  remainingQuota,
  requestExpiry,
  validateRequest,
  type PlanCode,
  type PlanConfig,
  type PlanFeatures,
  type RequestInput,
  type RequestType,
  type WriterRole,
} from '@pluma/domain';
import { storeNetworkDemo } from './audio';
import type { Deps, RequestCtx } from './deps';
import { emit } from './events';
import { loadPlans } from './membership';
import { createWork, setDraftSplit, submitForSignatures } from './works';

const ctxOf = (userId: string, command: string, ctx?: RequestCtx) => ({ actorId: userId, actorRole: 'writer' as const, command, ...ctx });
type AudioFile = { bytes: Buffer; mime: string } | null;

/* ------------------------------- Acceso a la red ------------------------------- */

/**
 * La red es para miembros con plan vigente (la suspensión la apaga) y mayores de edad:
 * los menores no aparecen en la red sin autorización del tutor.
 */
export async function assertNetworkMember(deps: Deps, userId: string) {
  const [row] = await deps.db
    .select({ plan: t.memberships.planCode, status: t.memberships.status, end: t.memberships.currentPeriodEnd, birth: t.writerProfiles.birthDate, country: t.writerProfiles.country, visible: t.writerProfiles.networkVisible })
    .from(t.memberships)
    .innerJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.memberships.userId))
    .where(eq(t.memberships.userId, userId));
  if (!row) throw new DomainError('MEMBERSHIP_INACTIVE');
  const loaded = await loadPlans(deps);
  // Precios y límites editables viven en la tabla de planes; si falta algo, se usan los valores de arranque.
  const plans = Object.fromEntries(
    (Object.keys(DEFAULT_PLANS) as PlanCode[]).map((c) => [c, { ...DEFAULT_PLANS[c], features: { ...DEFAULT_PLANS[c].features, ...((loaded[c]?.features ?? {}) as Partial<PlanFeatures>) } }]),
  ) as Record<PlanCode, PlanConfig>;
  const snapshot = { plan: row.plan, status: row.status, currentPeriodEnd: row.end ? new Date(row.end) : null };
  if (!canUseFeature(snapshot, 'network', deps.now(), plans)) throw new DomainError('MEMBERSHIP_INACTIVE');
  if (isMinor(row.birth, row.country, deps.now()) || !row.visible) throw new DomainError('NETWORK_MINOR');
  return { plan: row.plan, limit: plans[row.plan].features.dailyApplications, featured: plans[row.plan].features.featuredProfile };
}

export async function quotaFor(deps: Deps, userId: string, limit: number) {
  const since = new Date(deps.now().getTime() - 86_400_000).toISOString();
  const recent = await deps.db.select({ at: t.applications.createdAt }).from(t.applications).where(and(eq(t.applications.applicantUserId, userId), sql`${t.applications.createdAt} > ${since}`));
  return remainingQuota(limit, recent.map((r) => new Date(r.at)), deps.now());
}

/* -------------------------------- Tablero (A34) -------------------------------- */

export interface BoardFilters {
  type?: string;
  genre?: string;
  language?: string;
  city?: string;
  modality?: string;
  q?: string;
}

export interface BoardItem {
  id: string;
  type: RequestType;
  title: string;
  description: string;
  genre: string;
  languages: string[];
  bpm: number | null;
  city: string | null;
  modality: string;
  offeredShareBps: number;
  featured: boolean;
  hasDemo: boolean;
  authorId: string;
  authorName: string;
  authorCity: string | null;
  applications: number;
  mine: boolean;
  myApplication: string | null;
  createdAt: string;
  expiresAt: string;
}

/** Solicitudes abiertas y visibles. Los perfiles Pro aparecen primero (destacados). */
export async function board(deps: Deps, viewerId: string, f: BoardFilters = {}): Promise<BoardItem[]> {
  const now = deps.now().toISOString();
  const q = f.q?.trim();
  const rows = await deps.db.execute<{
    id: string; type: RequestType; title: string; description: string; genre: string; languages: string[]; bpm: number | null; city: string | null; modality: string;
    offered_share_bps: number; featured: boolean; demo_file_id: string | null; author_user_id: string; author_name: string; author_city: string | null; applications: number;
    my_application: string | null; created_at: string; expires_at: string;
  }>(sql`
    select r.id, r.type, r.title, r.description, r.genre, r.languages, r.bpm, r.city, r.modality, r.offered_share_bps, r.demo_file_id, r.author_user_id,
           coalesce(wp.artist_name, wp.legal_name) as author_name, wp.city as author_city,
           (m.plan_code = 'pro' and m.status in ('active', 'past_due')) as featured,
           (select count(*)::int from applications a where a.request_id = r.id) as applications,
           (select a.status::text from applications a where a.request_id = r.id and a.applicant_user_id = ${viewerId}) as my_application,
           r.created_at, r.expires_at
    from network_requests r
    join writer_profiles wp on wp.user_id = r.author_user_id
    join memberships m on m.user_id = r.author_user_id
    where r.status = 'open' and r.hidden_at is null and r.expires_at > ${now}
      and m.status in ('active', 'past_due')
      ${f.type ? sql`and r.type = ${f.type}::request_type` : sql``}
      ${f.modality ? sql`and r.modality = ${f.modality}::modality` : sql``}
      ${f.genre ? sql`and r.genre ilike ${`%${f.genre.trim()}%`}` : sql``}
      ${f.language ? sql`and ${f.language} = any(r.languages)` : sql``}
      ${f.city ? sql`and (r.city ilike ${`%${f.city.trim()}%`} or wp.city ilike ${`%${f.city.trim()}%`})` : sql``}
      ${q ? sql`and (r.title ilike ${`%${q}%`} or r.description ilike ${`%${q}%`} or r.genre ilike ${`%${q}%`})` : sql``}
    order by featured desc, r.created_at desc
    limit 100`);
  return rows.map((r) => ({
    id: r.id, type: r.type, title: r.title, description: r.description, genre: r.genre, languages: r.languages, bpm: r.bpm, city: r.city, modality: r.modality,
    offeredShareBps: r.offered_share_bps, featured: r.featured, hasDemo: !!r.demo_file_id, authorId: r.author_user_id, authorName: r.author_name, authorCity: r.author_city,
    applications: r.applications, mine: r.author_user_id === viewerId, myApplication: r.my_application, createdAt: String(r.created_at), expiresAt: String(r.expires_at),
  }));
}

/* ------------------------------ Publicar (A36) ------------------------------ */

const languagesOf = (xs: string[]) => [...new Set(xs.map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z]{2}$/.test(x)))];

export async function createRequest(deps: Deps, userId: string, input: RequestInput, demo: AudioFile, ctx: RequestCtx): Promise<string> {
  const clean = { ...input, title: input.title.trim(), description: input.description.trim(), genre: input.genre.trim(), languages: languagesOf(input.languages), city: input.city?.trim() || null };
  validateRequest(clean);
  await assertNetworkMember(deps, userId);
  const demoFileId = demo ? await storeNetworkDemo(deps, userId, demo, ctx) : null;
  return withSystem(deps.db, ctxOf(userId, 'network.publish', ctx), async (tx) => {
    const [r] = await tx
      .insert(t.networkRequests)
      .values({
        authorUserId: userId, type: clean.type, title: clean.title, description: clean.description, genre: clean.genre, languages: sql`${`{${clean.languages.join(',')}}`}::text[]` as unknown as string[],
        bpm: clean.bpm, city: clean.city, modality: clean.modality, offeredShareBps: clean.offeredShareBps, demoFileId, expiresAt: requestExpiry(deps.now()).toISOString(),
      })
      .returning({ id: t.networkRequests.id });
    return r!.id;
  });
}

async function ownRequest(tx: Tx, userId: string, requestId: string) {
  const [r] = await tx.select().from(t.networkRequests).where(eq(t.networkRequests.id, requestId)).for('update');
  if (!r) throw new DomainError('NOT_FOUND');
  if (r.authorUserId !== userId) throw new DomainError('FORBIDDEN');
  return r;
}

/** Renueva por 30 días más una solicitud abierta o vencida (no cubierta ni cerrada). */
export async function renewRequest(deps: Deps, userId: string, requestId: string, ctx: RequestCtx) {
  await assertNetworkMember(deps, userId);
  await withSystem(deps.db, ctxOf(userId, 'network.renew', ctx), async (tx) => {
    const r = await ownRequest(tx, userId, requestId);
    if (r.status !== 'open' && r.status !== 'expired') throw new DomainError('REQUEST_NOT_OPEN');
    await tx.update(t.networkRequests).set({ status: 'open', expiresAt: requestExpiry(deps.now()).toISOString(), renewedAt: deps.now().toISOString() }).where(eq(t.networkRequests.id, requestId));
  });
}

/** Cierra la solicitud: las postulaciones pendientes se declinan con aviso. */
export async function closeRequest(deps: Deps, userId: string, requestId: string, ctx: RequestCtx) {
  await withSystem(deps.db, ctxOf(userId, 'network.close', ctx), async (tx) => {
    const r = await ownRequest(tx, userId, requestId);
    if (r.status === 'closed') return;
    await tx.update(t.networkRequests).set({ status: 'closed', closedAt: deps.now().toISOString() }).where(eq(t.networkRequests.id, requestId));
    await declinePending(tx, deps, requestId, false);
  });
}

async function declinePending(tx: Tx, deps: Deps, requestId: string, filled: boolean, except?: string) {
  const pending = await tx.select({ id: t.applications.id }).from(t.applications).where(and(eq(t.applications.requestId, requestId), eq(t.applications.status, 'pending')));
  for (const p of pending.filter((x) => x.id !== except)) {
    await tx.update(t.applications).set({ status: 'declined', decidedAt: deps.now().toISOString() }).where(eq(t.applications.id, p.id));
    await emit(tx, 'application.declined', 'application', p.id, { filled });
  }
}

/* ------------------------------ Postularse (A37) ------------------------------ */

export async function apply(deps: Deps, userId: string, requestId: string, input: { message: string; acceptShare: boolean; sample: AudioFile }, ctx: RequestCtx): Promise<string> {
  const member = await assertNetworkMember(deps, userId);
  const message = input.message.trim();
  if (message.length < 10 || message.length > 1000) throw new DomainError('MESSAGE_REQUIRED');
  if (!input.acceptShare) throw new DomainError('SPLIT_NOT_ACCEPTED');
  const quota = await quotaFor(deps, userId, member.limit);
  if (quota.remaining === 0) throw new DomainError('DAILY_LIMIT', { nextSlotAt: quota.nextSlotAt?.toISOString() });
  const [pre] = await deps.db.select().from(t.networkRequests).where(eq(t.networkRequests.id, requestId));
  if (!pre || pre.hiddenAt) throw new DomainError('NOT_FOUND');
  if (pre.authorUserId === userId) throw new DomainError('OWN_REQUEST');
  const sampleFileId = input.sample ? await storeNetworkDemo(deps, userId, input.sample, ctx) : null;
  return withSystem(deps.db, ctxOf(userId, 'network.apply', ctx), async (tx) => {
    const [r] = await tx.select().from(t.networkRequests).where(eq(t.networkRequests.id, requestId)).for('update');
    if (!r || r.status !== 'open' || (r.expiresAt && new Date(r.expiresAt) <= deps.now())) throw new DomainError('REQUEST_NOT_OPEN');
    // Cupo re-verificado dentro de la transacción (dos envíos a la vez no lo exceden).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`apply:${userId}`}))`);
    const [{ n }] = (await tx.execute<{ n: number }>(sql`select count(*)::int as n from applications where applicant_user_id = ${userId} and created_at > ${new Date(deps.now().getTime() - 86_400_000).toISOString()}`)) as unknown as [{ n: number }];
    if (n >= member.limit) throw new DomainError('DAILY_LIMIT');
    const [a] = await tx
      .insert(t.applications)
      .values({ requestId, applicantUserId: userId, message, acceptedShareBps: r.offeredShareBps, sampleFileId, expiresAt: applicationExpiry(deps.now()).toISOString(), createdAt: deps.now().toISOString() })
      .onConflictDoNothing()
      .returning({ id: t.applications.id });
    if (!a) throw new DomainError('ALREADY_APPLIED');
    await emit(tx, 'application.submitted', 'application', a.id);
    return a.id;
  });
}

export async function withdrawApplication(deps: Deps, userId: string, applicationId: string, ctx: RequestCtx) {
  await withSystem(deps.db, ctxOf(userId, 'network.withdraw', ctx), async (tx) => {
    const [a] = await tx.select().from(t.applications).where(eq(t.applications.id, applicationId)).for('update');
    if (!a || a.applicantUserId !== userId) throw new DomainError('NOT_FOUND');
    if (a.status !== 'pending') throw new DomainError('APPLICATION_NOT_PENDING');
    await tx.update(t.applications).set({ status: 'withdrawn', decidedAt: deps.now().toISOString() }).where(eq(t.applications.id, applicationId));
  });
}

/* --------------------------- Aceptar o declinar (A38) --------------------------- */

async function pendingForOwner(tx: Tx, deps: Deps, userId: string, applicationId: string) {
  const [a] = await tx.select().from(t.applications).where(eq(t.applications.id, applicationId)).for('update');
  if (!a) throw new DomainError('NOT_FOUND');
  const r = await ownRequest(tx, userId, a.requestId);
  if (a.status !== 'pending' || new Date(a.expiresAt) <= deps.now()) throw new DomainError('APPLICATION_NOT_PENDING');
  return { a, r };
}

/** Acepta: nace la colaboración con el split pre-acordado y se revelan los contactos de ambas partes. */
export async function acceptApplication(deps: Deps, userId: string, applicationId: string, ctx: RequestCtx): Promise<string> {
  await assertNetworkMember(deps, userId);
  return withSystem(deps.db, ctxOf(userId, 'network.accept', ctx), async (tx) => {
    const { a, r } = await pendingForOwner(tx, deps, userId, applicationId);
    if (r.status !== 'open') throw new DomainError('REQUEST_NOT_OPEN');
    const shares = preAgreedShares(r.type, r.authorUserId, a.applicantUserId, a.acceptedShareBps);
    const [c] = await tx
      .insert(t.collaborations)
      .values({ requestId: r.id, applicationId: a.id, preAgreedShares: shares.map((s) => ({ user_id: s.userId, role: s.role, share_bps: s.bps })) })
      .returning({ id: t.collaborations.id });
    await tx.update(t.applications).set({ status: 'accepted', decidedAt: deps.now().toISOString() }).where(eq(t.applications.id, a.id));
    // Un camp admite varias personas; las demás solicitudes se cubren con una.
    if (r.type !== 'session_or_camp') {
      await tx.update(t.networkRequests).set({ status: 'filled', closedAt: deps.now().toISOString() }).where(eq(t.networkRequests.id, r.id));
      await declinePending(tx, deps, r.id, true, a.id);
    }
    await emit(tx, 'application.accepted', 'collaboration', c!.id);
    return c!.id;
  });
}

export async function declineApplication(deps: Deps, userId: string, applicationId: string, ctx: RequestCtx) {
  await withSystem(deps.db, ctxOf(userId, 'network.decline', ctx), async (tx) => {
    const { a } = await pendingForOwner(tx, deps, userId, applicationId);
    await tx.update(t.applications).set({ status: 'declined', decidedAt: deps.now().toISOString() }).where(eq(t.applications.id, a.id));
    await emit(tx, 'application.declined', 'application', a.id, { filled: false });
  });
}

/* ------------------------------ Vistas del autor ------------------------------ */

export interface ApplicantCard {
  applicationId: string;
  userId: string;
  name: string;
  role: WriterRole | null;
  city: string | null;
  languages: string[];
  message: string;
  shareBps: number;
  status: string;
  sampleFileId: string | null;
  expiresAt: string;
  createdAt: string;
  credits: { title: string; role: string; artist: string | null; dspUrl: string | null; source: string }[];
  history: { memberSince: string; registeredWorks: number; collaborations: number };
}

/** Detalle de una solicitud (A35). Si es propia, incluye las postulaciones con la tarjeta de cada postulante. */
export async function getRequest(deps: Deps, viewerId: string, requestId: string) {
  const [r] = await deps.db.select().from(t.networkRequests).where(eq(t.networkRequests.id, requestId));
  if (!r) return null;
  const mine = r.authorUserId === viewerId;
  if (!mine && (r.hiddenAt || r.status !== 'open')) {
    const [own] = await deps.db.select({ id: t.applications.id }).from(t.applications).where(and(eq(t.applications.requestId, requestId), eq(t.applications.applicantUserId, viewerId)));
    if (!own) return null;
  }
  const { publicCard } = await import('./profiles');
  const author = await publicCard(deps, r.authorUserId);
  const [my] = await deps.db.select().from(t.applications).where(and(eq(t.applications.requestId, requestId), eq(t.applications.applicantUserId, viewerId)));
  let quota = null;
  if (!mine) {
    const m = await assertNetworkMember(deps, viewerId).catch(() => null);
    quota = m ? await quotaFor(deps, viewerId, m.limit) : null;
  }
  const collaboration = my?.status === 'accepted' ? (await deps.db.select({ id: t.collaborations.id }).from(t.collaborations).where(eq(t.collaborations.applicationId, my.id)))[0]?.id ?? null : null;
  return {
    request: { ...r, expired: !!r.expiresAt && new Date(r.expiresAt) <= deps.now() },
    author,
    mine,
    myApplication: my ? { id: my.id, status: my.status, expiresAt: my.expiresAt, collaborationId: collaboration } : null,
    quota,
    applications: mine ? await applicantsOf(deps, requestId) : [],
  };
}

async function applicantsOf(deps: Deps, requestId: string): Promise<(ApplicantCard & { collaborationId: string | null })[]> {
  const apps = await deps.db.select().from(t.applications).where(eq(t.applications.requestId, requestId)).orderBy(desc(t.applications.createdAt));
  const { publicCard } = await import('./profiles');
  const collabs = apps.length ? await deps.db.select({ id: t.collaborations.id, applicationId: t.collaborations.applicationId }).from(t.collaborations).where(inArray(t.collaborations.applicationId, apps.map((a) => a.id))) : [];
  const out = [];
  for (const a of apps) {
    const card = await publicCard(deps, a.applicantUserId);
    out.push({
      applicationId: a.id, userId: a.applicantUserId, name: card.name, role: card.mainRole, city: card.city, languages: card.languages, message: a.message, shareBps: a.acceptedShareBps,
      status: a.status, sampleFileId: a.sampleFileId, expiresAt: a.expiresAt, createdAt: a.createdAt, credits: card.credits, history: card.history,
      collaborationId: collabs.find((c) => c.applicationId === a.id)?.id ?? null,
    });
  }
  return out;
}

/** Mis solicitudes (A38): con conteo de postulaciones por estado. */
export async function myRequests(deps: Deps, userId: string) {
  return deps.db.execute<{ id: string; title: string; type: RequestType; status: string; expires_at: string; created_at: string; pending: number; total: number; hidden: boolean }>(sql`
    select r.id, r.title, r.type, r.status, r.expires_at, r.created_at, r.hidden_at is not null as hidden,
           count(a.id) filter (where a.status = 'pending')::int as pending, count(a.id)::int as total
    from network_requests r left join applications a on a.request_id = r.id
    where r.author_user_id = ${userId}
    group by r.id order by r.created_at desc`);
}

/** Mis postulaciones (A39): estado, vencimiento y, si fue aceptada, la colaboración. */
export async function myApplications(deps: Deps, userId: string) {
  return deps.db.execute<{ id: string; request_id: string; title: string; type: RequestType; author_name: string; status: string; expires_at: string; created_at: string; collaboration_id: string | null }>(sql`
    select a.id, r.id as request_id, r.title, r.type, coalesce(wp.artist_name, wp.legal_name) as author_name, a.status, a.expires_at, a.created_at, c.id as collaboration_id
    from applications a join network_requests r on r.id = a.request_id join writer_profiles wp on wp.user_id = r.author_user_id
    left join collaborations c on c.application_id = a.id
    where a.applicant_user_id = ${userId} order by a.created_at desc`);
}

/* --------------------------- Colaboración (A40) --------------------------- */

async function collaborationParties(deps: Deps, collaborationId: string) {
  const [c] = await deps.db.select().from(t.collaborations).where(eq(t.collaborations.id, collaborationId));
  if (!c) return null;
  const [r] = await deps.db.select().from(t.networkRequests).where(eq(t.networkRequests.id, c.requestId));
  const shares = c.preAgreedShares as { user_id: string; role: WriterRole; share_bps: number }[];
  const people = await deps.db
    .select({ id: t.users.id, email: t.users.email, phone: t.users.phoneE164, name: sql<string>`coalesce(${t.writerProfiles.artistName}, ${t.writerProfiles.legalName})`, legalName: t.writerProfiles.legalName, city: t.writerProfiles.city })
    .from(t.users)
    .innerJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.users.id))
    .where(inArray(t.users.id, shares.map((s) => s.user_id)));
  return { c, r: r!, parties: shares.map((s) => ({ ...s, ...people.find((p) => p.id === s.user_id)! })) };
}

/** Solo las dos partes ven la colaboración, y con ella los datos de contacto. */
export async function getCollaboration(deps: Deps, viewerId: string, collaborationId: string) {
  const x = await collaborationParties(deps, collaborationId);
  if (!x || !x.parties.some((p) => p.user_id === viewerId)) return null;
  return {
    id: x.c.id,
    requestId: x.r.id,
    requestTitle: x.r.title,
    requestType: x.r.type,
    genre: x.r.genre,
    sessionUrl: x.c.sessionUrl,
    workId: x.c.workId,
    closedAt: x.c.closedAt,
    createdAt: x.c.createdAt,
    parties: x.parties.map((p) => ({ userId: p.user_id, name: p.name, role: p.role, shareBps: p.share_bps, email: p.email, phone: p.phone, city: p.city, isMe: p.user_id === viewerId })),
  };
}

export async function myCollaborations(deps: Deps, userId: string) {
  return deps.db.execute<{ id: string; title: string; created_at: string; work_id: string | null; closed_at: string | null }>(sql`
    select c.id, r.title, c.created_at, c.work_id, c.closed_at from collaborations c join network_requests r on r.id = c.request_id
    where c.pre_agreed_shares @> ${JSON.stringify([{ user_id: userId }])}::jsonb order by c.created_at desc`);
}

export async function setSessionUrl(deps: Deps, userId: string, collaborationId: string, url: string, ctx: RequestCtx) {
  const v = url.trim();
  if (v) {
    let u: URL;
    try {
      u = new URL(v);
    } catch {
      throw new DomainError('SESSION_URL_INVALID');
    }
    if (u.protocol !== 'https:') throw new DomainError('SESSION_URL_INVALID');
  }
  const c = await getCollaboration(deps, userId, collaborationId);
  if (!c) throw new DomainError('NOT_FOUND');
  await withSystem(deps.db, ctxOf(userId, 'network.session_url', ctx), (tx) => tx.update(t.collaborations).set({ sessionUrl: v || null }).where(eq(t.collaborations.id, collaborationId)));
}

/** Idioma de la obra a partir de los de la solicitud (códigos de dos letras). */
const workLanguage = (langs: string[]) => langs[0] ?? 'es';

/**
 * Cerrar canción: crea la obra con el split pre-acordado, quien cierra firma al enviar y la otra parte
 * recibe la invitación a firmar. Con todas las firmas, la obra pasa a registro como cualquier otra.
 */
export async function closeSong(deps: Deps, userId: string, collaborationId: string, input: { title?: string }, ctx: RequestCtx): Promise<string> {
  const x = await collaborationParties(deps, collaborationId);
  if (!x || !x.parties.some((p) => p.user_id === userId)) throw new DomainError('NOT_FOUND');
  // Reclama el cierre: dos clics (o las dos partes a la vez) no crean dos obras.
  const [claimed] = await withSystem(deps.db, ctxOf(userId, 'network.close_song', ctx), (tx) =>
    tx
      .update(t.collaborations)
      .set({ closedAt: deps.now().toISOString(), closedBy: userId })
      .where(and(eq(t.collaborations.id, collaborationId), sql`${t.collaborations.closedAt} is null`))
      .returning({ id: t.collaborations.id }),
  );
  if (!claimed) throw new DomainError('COLLABORATION_CLOSED');
  try {
    const title = input.title?.trim() || x.r.title;
    const workId = await createWork(deps, userId, { title, altTitles: [], language: workLanguage(x.r.languages), genre: x.r.genre, lyrics: null, aiDeclaration: 'none', isrcs: [] }, ctx);
    await setDraftSplit(deps, userId, workId, x.parties.map((p) => ({ kind: 'member' as const, userId: p.user_id, role: p.role, bps: p.share_bps })), ctx);
    await submitForSignatures(deps, userId, workId, ctx);
    await withSystem(deps.db, ctxOf(userId, 'network.close_song', ctx), (tx) => tx.update(t.collaborations).set({ workId }).where(eq(t.collaborations.id, collaborationId)));
    return workId;
  } catch (e) {
    await withSystem(deps.db, ctxOf(userId, 'network.close_song_failed', ctx), (tx) => tx.update(t.collaborations).set({ closedAt: null, closedBy: null }).where(and(eq(t.collaborations.id, collaborationId), sql`${t.collaborations.workId} is null`)));
    throw e;
  }
}

/* ------------------------------- Tiempos ------------------------------- */

/**
 * Recordatorio a las 72 h, vencimiento de postulaciones a los 7 días y de solicitudes a los 30.
 * Lo corre el worker cada hora (y la app al responder, en la demo sin worker). Idempotente.
 */
export async function runNetworkTimers(deps: Deps) {
  const now = deps.now();
  const pending = await deps.db.select().from(t.applications).where(eq(t.applications.status, 'pending'));
  let reminded = 0;
  let expired = 0;
  for (const a of pending) {
    const action = applicationTimer(new Date(a.createdAt), a.reminderSentAt ? new Date(a.reminderSentAt) : null, new Date(a.expiresAt), now);
    if (action === 'wait') continue;
    await withSystem(deps.db, { actorId: null, actorRole: 'system', command: `network.${action}` }, async (tx) => {
      const [locked] = await tx.select().from(t.applications).where(and(eq(t.applications.id, a.id), eq(t.applications.status, 'pending'))).for('update', { skipLocked: true });
      if (!locked) return;
      if (action === 'remind' && !locked.reminderSentAt) {
        await tx.update(t.applications).set({ reminderSentAt: now.toISOString() }).where(eq(t.applications.id, a.id));
        await emit(tx, 'application.reminder', 'application', a.id);
        reminded++;
      } else if (action === 'expire') {
        await tx.update(t.applications).set({ status: 'expired', decidedAt: now.toISOString() }).where(eq(t.applications.id, a.id));
        await emit(tx, 'application.expired', 'application', a.id);
        expired++;
      }
    });
  }
  const requests = await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'network.expire_requests' }, (tx) =>
    tx
      .update(t.networkRequests)
      .set({ status: 'expired' })
      .where(and(eq(t.networkRequests.status, 'open'), sql`${t.networkRequests.expiresAt} <= ${now.toISOString()}`))
      .returning({ id: t.networkRequests.id }),
  );
  return { reminded, expired, requestsExpired: requests.length };
}

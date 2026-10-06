import { createHmac, randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, t, withSystem, sql, type Tx } from '@pluma/db';
import {
  DomainError,
  HOLD_DAYS,
  LICENSE_USAGES,
  MOODS,
  TERMS,
  TERRITORIES,
  VOCALS,
  isValidEmail,
  quote,
  type LicenseUsage,
  type SyncFilters,
} from '@pluma/domain';
import * as admin from './admin';
import { ensureWorkPreview } from './audio';
import { sha256 } from './crypto';
import type { Deps, RequestCtx } from './deps';
import { emit } from './events';

const DAY = 86_400_000;
const INVITE_TTL_DAYS = 14;

/* ------------------------------- Acceso y visibilidad ------------------------------- */

type Role = 'ar_guest' | 'sync_buyer';
async function rolesOf(deps: Deps, userId: string) {
  return (await deps.db.select({ role: t.userRoles.role }).from(t.userRoles).where(eq(t.userRoles.userId, userId))).map((r) => r.role as string);
}
async function requireRole(deps: Deps, userId: string, role: Role) {
  const roles = await rolesOf(deps, userId);
  if (!roles.includes(role) && !roles.some((r) => r === 'operator' || r === 'super_admin')) throw new DomainError('FORBIDDEN');
}

const SIGNED = sql`w.status in ('splits_signed', 'sent_to_publisher', 'registered')`;
/** A&R: obras sin grabar con opt-in, con autor de plan vigente (la suspensión las oculta). */
const AR_VISIBLE = sql`w.ar_opt_in and not w.opt_ins_suspended and ${SIGNED} and not exists (select 1 from recordings r where r.work_id = w.id)`;
const SYNC_VISIBLE = sql`w.sync_opt_in and not w.opt_ins_suspended and ${SIGNED}`;

/** ¿Por qué puede escuchar el demo de una obra? 'ar' | 'sync' | 'owner' | 'staff' | null. */
export async function catalogAccess(deps: Deps, viewerId: string, workId: string): Promise<string | null> {
  const roles = await rolesOf(deps, viewerId);
  if (roles.some((r) => ['operator', 'approver', 'super_admin'].includes(r))) return 'staff';
  const [member] = await deps.db.execute<{ ok: boolean }>(sql`
    select true as ok from split_versions sv join split_shares ss on ss.split_version_id = sv.id
    where sv.work_id = ${workId} and ss.writer_user_id = ${viewerId} limit 1`);
  if (member) return 'owner';
  if (roles.includes('ar_guest')) {
    const [v] = await deps.db.execute(sql`select 1 from works w where w.id = ${workId} and ${AR_VISIBLE}`);
    if (v) return 'ar';
  }
  if (roles.includes('sync_buyer')) {
    const [v] = await deps.db.execute(sql`select 1 from works w where w.id = ${workId} and ${SYNC_VISIBLE}`);
    if (v) return 'sync';
  }
  return null;
}

/** Autores socios con firma en el split vigente (aprueban licencias y reciben avisos). */
async function memberWriters(deps: Deps | { db: Tx }, workId: string) {
  const rows = await deps.db.execute<{ user_id: string }>(sql`
    select distinct ss.writer_user_id as user_id from split_versions sv join split_shares ss on ss.split_version_id = sv.id
    where sv.work_id = ${workId} and sv.status = 'signed' and ss.writer_user_id is not null`);
  return rows.map((r) => r.user_id);
}

/* ------------------------- Metadatos de catálogo (A31) ------------------------- */

export interface CatalogMetadata {
  bpm: number | null;
  musicalKey: string | null;
  moods: string[];
  vocals: string | null;
  instrumentalAvailable: boolean;
  description: string | null;
}

export async function updateCatalogMetadata(deps: Deps, userId: string, workId: string, m: CatalogMetadata, ctx: RequestCtx) {
  const [w] = await deps.db.select().from(t.works).where(eq(t.works.id, workId));
  if (!w) throw new DomainError('WORK_NOT_FOUND');
  if (w.createdBy !== userId) throw new DomainError('FORBIDDEN');
  if (m.bpm !== null && (!Number.isInteger(m.bpm) || m.bpm < 30 || m.bpm > 300)) throw new DomainError('CATALOG_BPM_INVALID');
  const moods = [...new Set(m.moods)].filter((x): x is (typeof MOODS)[number] => (MOODS as readonly string[]).includes(x)).slice(0, 5);
  if (m.vocals && !(VOCALS as readonly string[]).includes(m.vocals)) throw new DomainError('VOCALS_INVALID');
  const description = m.description?.trim().slice(0, 600) || null;
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'work.catalog_metadata', ...ctx }, (tx) =>
    tx
      .update(t.works)
      .set({ bpm: m.bpm, musicalKey: m.musicalKey?.trim().slice(0, 12) || null, moods: sql`${`{${moods.join(',')}}`}::text[]` as unknown as string[], vocals: m.vocals || null, instrumentalAvailable: m.instrumentalAvailable, catalogDescription: description })
      .where(eq(t.works.id, workId)),
  );
}

/** Al activar un catálogo se prepara la versión de escucha protegida del demo. */
export async function prepareCatalogAudio(deps: Deps, workId: string) {
  try {
    return await ensureWorkPreview(deps, workId);
  } catch (e) {
    console.error('[catálogo] no se pudo preparar la escucha', (e as Error).message);
    return null;
  }
}

/* ================================== A&R ================================== */

const inviteToken = (deps: Deps, invitationId: string) => createHmac('sha256', deps.signingSecret).update(`ar-invite:${invitationId}`).digest('base64url');
export const arInviteUrl = (deps: Deps, invitationId: string) => `${deps.appUrl}/ar/invitacion/${invitationId}.${inviteToken(deps, invitationId)}`;

/** E18 · Invitar a un A&R (sello o artista). El enlace vence en 14 días. */
export async function inviteAr(deps: Deps, staffId: string, input: { email: string; company: string }, ctx: RequestCtx) {
  const roles = await admin.staffRoles(deps, staffId);
  const role = roles.find((r) => r === 'operator' || r === 'super_admin');
  if (!role) throw new DomainError('FORBIDDEN');
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) throw new DomainError('EMAIL_INVALID');
  if (input.company.trim().length < 2) throw new DomainError('COMPANY_REQUIRED');
  const id = randomUUID();
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: 'ar.invite', ...ctx }, async (tx) => {
    await tx.insert(t.arInvitations).values({ id, email, company: input.company.trim(), invitedBy: staffId, tokenHash: sha256(inviteToken(deps, id)), expiresAt: new Date(deps.now().getTime() + INVITE_TTL_DAYS * DAY).toISOString() });
    await emit(tx, 'ar.invited', 'ar_invitation', id);
  });
  return id;
}

async function invitationFromToken(deps: Deps, token: string) {
  const [id, mac] = token.split('.');
  if (!id || !mac || !/^[0-9a-f-]{36}$/.test(id) || inviteToken(deps, id) !== mac) return null;
  const [inv] = await deps.db.select().from(t.arInvitations).where(eq(t.arInvitations.id, id));
  return inv ?? null;
}

export async function invitationInfo(deps: Deps, token: string) {
  const inv = await invitationFromToken(deps, token);
  if (!inv) return null;
  return { email: inv.email, company: inv.company, expired: new Date(inv.expiresAt) <= deps.now(), revoked: !!inv.revokedAt, accepted: !!inv.acceptedUserId };
}

/** C1 · Aceptar: la cuenta debe ser la del correo invitado. */
export async function acceptArInvitation(deps: Deps, userId: string, token: string, ctx: RequestCtx) {
  const inv = await invitationFromToken(deps, token);
  if (!inv || inv.revokedAt) throw new DomainError('INVITATION_NOT_FOUND');
  if (inv.acceptedUserId === userId) return;
  if (inv.acceptedUserId || new Date(inv.expiresAt) <= deps.now()) throw new DomainError('INVITATION_EXPIRED');
  const [u] = await deps.db.select({ email: t.users.email }).from(t.users).where(eq(t.users.id, userId));
  if (!u || u.email.toLowerCase() !== inv.email.toLowerCase()) throw new DomainError('INVITATION_OTHER_EMAIL');
  await withSystem(deps.db, { actorId: userId, actorRole: 'ar_guest', command: 'ar.accept', ...ctx }, async (tx) => {
    await tx.update(t.arInvitations).set({ acceptedUserId: userId }).where(eq(t.arInvitations.id, inv.id));
    await tx.insert(t.userRoles).values({ userId, role: 'ar_guest', grantedBy: inv.invitedBy }).onConflictDoNothing();
  });
}

export async function revokeArInvitation(deps: Deps, staffId: string, invitationId: string, ctx: RequestCtx) {
  const roles = await admin.staffRoles(deps, staffId);
  const role = roles.find((r) => r === 'operator' || r === 'super_admin');
  if (!role) throw new DomainError('FORBIDDEN');
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: 'ar.revoke', ...ctx }, async (tx) => {
    const [inv] = await tx.update(t.arInvitations).set({ revokedAt: deps.now().toISOString() }).where(eq(t.arInvitations.id, invitationId)).returning();
    if (inv?.acceptedUserId) await tx.delete(t.userRoles).where(and(eq(t.userRoles.userId, inv.acceptedUserId), eq(t.userRoles.role, 'ar_guest')));
  });
}

export async function arCompany(deps: Deps, userId: string) {
  const [inv] = await deps.db.select({ company: t.arInvitations.company }).from(t.arInvitations).where(eq(t.arInvitations.acceptedUserId, userId)).orderBy(desc(t.arInvitations.createdAt)).limit(1);
  return inv?.company ?? null;
}

export interface CatalogItem {
  id: string;
  title: string;
  language: string;
  genre: string;
  bpm: number | null;
  musicalKey: string | null;
  moods: string[];
  vocals: string | null;
  instrumentalAvailable: boolean;
  oneStop: boolean;
  description: string | null;
  artistName: string | null;
  lyricsExcerpt: string | null;
  previewFileId: string | null;
  waveform: number[] | null;
  heldUntil: string | null;
}

const ITEM_COLS = sql`w.id, w.title, w.language, w.genre, w.bpm, w.musical_key, w.moods, w.vocals, w.instrumental_available, w.one_stop, w.catalog_description,
  (select f.id from work_files f where f.work_id = w.id and f.kind = 'demo_preview' limit 1) as preview_file_id,
  (select f.waveform from work_files f where f.work_id = w.id and f.kind = 'demo_preview' limit 1) as waveform,
  (select h.ends_at from holds h where h.work_id = w.id and h.status = 'active' and h.ends_at > now() limit 1) as held_until`;
type ItemRow = { id: string; title: string; language: string; genre: string; bpm: number | null; musical_key: string | null; moods: string[]; vocals: string | null; instrumental_available: boolean; one_stop: boolean; catalog_description: string | null; preview_file_id: string | null; waveform: number[] | null; held_until: string | null; artist_name?: string | null; lyrics_excerpt?: string | null; rank?: number };
const toItem = (r: ItemRow): CatalogItem => ({
  id: r.id, title: r.title, language: r.language, genre: r.genre, bpm: r.bpm, musicalKey: r.musical_key, moods: r.moods, vocals: r.vocals, instrumentalAvailable: r.instrumental_available, oneStop: r.one_stop,
  description: r.catalog_description, artistName: r.artist_name ?? null, lyricsExcerpt: r.lyrics_excerpt ?? null, previewFileId: r.preview_file_id, waveform: r.waveform, heldUntil: r.held_until ? String(r.held_until) : null,
});

/** C2 · Catálogo A&R: obras sin grabar con opt-in. Solo nombre artístico y extracto de letra. */
export async function arCatalog(deps: Deps, viewerId: string, f: { q?: string; genre?: string; language?: string; mood?: string } = {}) {
  await requireRole(deps, viewerId, 'ar_guest');
  const q = f.q?.trim();
  const rows = await deps.db.execute<ItemRow>(sql`
    select ${ITEM_COLS}, wp.artist_name, left(w.lyrics, 280) as lyrics_excerpt
    from works w join writer_profiles wp on wp.user_id = w.created_by
    where ${AR_VISIBLE}
      ${f.genre ? sql`and w.genre ilike ${`%${f.genre}%`}` : sql``}
      ${f.language ? sql`and w.language = ${f.language}` : sql``}
      ${f.mood ? sql`and ${f.mood} = any(w.moods)` : sql``}
      ${q ? sql`and (w.title ilike ${`%${q}%`} or w.genre ilike ${`%${q}%`} or w.catalog_description ilike ${`%${q}%`} or wp.artist_name ilike ${`%${q}%`})` : sql``}
    order by w.created_at desc limit 100`);
  return rows.map(toItem);
}

export async function arWork(deps: Deps, viewerId: string, workId: string) {
  await requireRole(deps, viewerId, 'ar_guest');
  const [r] = await deps.db.execute<ItemRow>(sql`
    select ${ITEM_COLS}, wp.artist_name, left(w.lyrics, 280) as lyrics_excerpt
    from works w join writer_profiles wp on wp.user_id = w.created_by where w.id = ${workId} and ${AR_VISIBLE}`);
  if (!r) return null;
  const [interest] = await deps.db.select().from(t.arInterests).where(and(eq(t.arInterests.workId, workId), eq(t.arInterests.arUserId, viewerId)));
  const holds = await deps.db.select().from(t.holds).where(and(eq(t.holds.workId, workId), eq(t.holds.requesterUserId, viewerId))).orderBy(desc(t.holds.createdAt));
  return { work: toItem(r), interested: !!interest, holds };
}

/** C3 · "Me interesa grabarla": avisa a los autores socios de la obra. */
export async function expressInterest(deps: Deps, arId: string, workId: string, message: string, ctx: RequestCtx) {
  if (!(await arWork(deps, arId, workId))) throw new DomainError('WORK_NOT_FOUND');
  await withSystem(deps.db, { actorId: arId, actorRole: 'ar_guest', command: 'ar.interest', ...ctx }, async (tx) => {
    const [i] = await tx.insert(t.arInterests).values({ workId, arUserId: arId, message: message.trim().slice(0, 1000) || null }).onConflictDoNothing().returning({ id: t.arInterests.id });
    if (i) await emit(tx, 'ar.interest', 'ar_interest', i.id);
  });
}

/** C3 · Pedir un hold de 30, 60 o 90 días. Lo aprueba quien registró la obra. Sin cobro en el MVP. */
export async function requestHold(deps: Deps, arId: string, workId: string, days: number, message: string, ctx: RequestCtx) {
  if (!(HOLD_DAYS as readonly number[]).includes(days)) throw new DomainError('HOLD_DAYS_INVALID');
  const view = await arWork(deps, arId, workId);
  if (!view) throw new DomainError('WORK_NOT_FOUND');
  if (view.work.heldUntil) throw new DomainError('WORK_ON_HOLD');
  if (view.holds.some((h) => h.status === 'requested')) throw new DomainError('HOLD_ALREADY_REQUESTED');
  return withSystem(deps.db, { actorId: arId, actorRole: 'ar_guest', command: 'hold.request', ...ctx }, async (tx) => {
    const [h] = await tx.insert(t.holds).values({ workId, requesterUserId: arId, durationDays: days, message: message.trim().slice(0, 1000) || null }).returning({ id: t.holds.id });
    await emit(tx, 'hold.requested', 'hold', h!.id);
    return h!.id;
  });
}

/** A32 · El autor aprueba o rechaza. Aprobar activa la reserva y rechaza las demás solicitudes pendientes de esa obra. */
export async function decideHold(deps: Deps, userId: string, holdId: string, approve: boolean, reason: string, ctx: RequestCtx) {
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: approve ? 'hold.approve' : 'hold.reject', ...ctx }, async (tx) => {
    const [h] = await tx.select().from(t.holds).where(eq(t.holds.id, holdId)).for('update');
    if (!h) throw new DomainError('NOT_FOUND');
    const [w] = await tx.select({ owner: t.works.createdBy }).from(t.works).where(eq(t.works.id, h.workId));
    if (w?.owner !== userId) throw new DomainError('FORBIDDEN');
    if (h.status !== 'requested') throw new DomainError('HOLD_NOT_PENDING');
    const now = deps.now();
    if (approve) {
      const [active] = await tx.select({ id: t.holds.id }).from(t.holds).where(and(eq(t.holds.workId, h.workId), inArray(t.holds.status, ['approved', 'active'])));
      if (active) throw new DomainError('WORK_ON_HOLD');
      await tx.update(t.holds).set({ status: 'active', decidedBy: userId, decidedAt: now.toISOString(), startsAt: now.toISOString(), endsAt: new Date(now.getTime() + h.durationDays * DAY).toISOString() }).where(eq(t.holds.id, holdId));
      const others = await tx.update(t.holds).set({ status: 'rejected', decidedBy: userId, decidedAt: now.toISOString(), rejectReason: 'other_hold' }).where(and(eq(t.holds.workId, h.workId), eq(t.holds.status, 'requested'))).returning({ id: t.holds.id });
      for (const o of others) await emit(tx, 'hold.decided', 'hold', o.id);
    } else {
      await tx.update(t.holds).set({ status: 'rejected', decidedBy: userId, decidedAt: now.toISOString(), rejectReason: reason.trim().slice(0, 500) || null }).where(eq(t.holds.id, holdId));
    }
    await emit(tx, 'hold.decided', 'hold', holdId);
  });
}

/** C4 · Mis intereses y holds. */
export async function arActivity(deps: Deps, arId: string) {
  await requireRole(deps, arId, 'ar_guest');
  const interests = await deps.db.execute<{ work_id: string; title: string; created_at: string }>(sql`
    select i.work_id, w.title, i.created_at from ar_interests i join works w on w.id = i.work_id where i.ar_user_id = ${arId} order by i.created_at desc`);
  const holds = await deps.db.execute<{ id: string; work_id: string; title: string; status: string; duration_days: number; ends_at: string | null; created_at: string; reject_reason: string | null }>(sql`
    select h.id, h.work_id, w.title, h.status, h.duration_days, h.ends_at, h.created_at, h.reject_reason from holds h join works w on w.id = h.work_id where h.requester_user_id = ${arId} order by h.created_at desc`);
  return { interests, holds };
}

/** A32 · Solicitudes de hold sobre mis obras. */
export async function holdsForOwner(deps: Deps, userId: string) {
  return deps.db.execute<{ id: string; work_id: string; title: string; status: string; duration_days: number; message: string | null; company: string | null; ends_at: string | null; created_at: string }>(sql`
    select h.id, h.work_id, w.title, h.status, h.duration_days, h.message, h.ends_at, h.created_at,
           (select i.company from ar_invitations i where i.accepted_user_id = h.requester_user_id order by i.created_at desc limit 1) as company
    from holds h join works w on w.id = h.work_id where w.created_by = ${userId} order by (h.status = 'requested') desc, h.created_at desc`);
}

/** Holds vencidos → expired (los corre el worker con los demás tiempos). */
export async function runCatalogTimers(deps: Deps) {
  const r = await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'hold.expire' }, (tx) =>
    tx.update(t.holds).set({ status: 'expired' }).where(and(eq(t.holds.status, 'active'), sql`${t.holds.endsAt} <= ${deps.now().toISOString()}`)).returning({ id: t.holds.id }),
  );
  return { holdsExpired: r.length };
}

/* ================================ Pluma Sync ================================ */

const COMPANY_TYPES = ['agency', 'production', 'brand', 'supervisor', 'other'] as const;

/** D1 · Alta de comprador: empresa, tipo y país. Da acceso al portal. */
export async function registerBuyer(deps: Deps, userId: string, input: { company: string; companyType: string; country: string }, ctx: RequestCtx) {
  const company = input.company.trim();
  if (company.length < 2) throw new DomainError('COMPANY_REQUIRED');
  if (!(COMPANY_TYPES as readonly string[]).includes(input.companyType)) throw new DomainError('COMPANY_TYPE_INVALID');
  if (!/^[A-Z]{2}$/.test(input.country)) throw new DomainError('COUNTRY_REQUIRED');
  await withSystem(deps.db, { actorId: userId, actorRole: 'sync_buyer', command: 'sync.register_buyer', ...ctx }, async (tx) => {
    await tx.insert(t.syncBuyers).values({ userId, company, companyType: input.companyType, country: input.country }).onConflictDoUpdate({ target: t.syncBuyers.userId, set: { company, companyType: input.companyType, country: input.country } });
    await tx.insert(t.userRoles).values({ userId, role: 'sync_buyer' }).onConflictDoNothing();
  });
}

export async function buyerProfile(deps: Deps, userId: string) {
  const [b] = await deps.db.select().from(t.syncBuyers).where(eq(t.syncBuyers.userId, userId));
  return b ?? null;
}

/**
 * D2/D3 · Búsqueda híbrida: el traductor convierte la consulta en filtros duros (BPM, voz, idioma, one-stop…)
 * que se aplican en SQL; el texto restante ordena por afinidad de texto completo. Los filtros de la pantalla mandan.
 */
export async function searchSync(deps: Deps, viewerId: string, query: string, ui: Partial<SyncFilters> = {}) {
  await requireRole(deps, viewerId, 'sync_buyer');
  const parsed = query.trim() ? await deps.queryParser.parse(query) : null;
  const f: SyncFilters = {
    text: parsed?.text ?? '',
    moods: ui.moods?.length ? ui.moods : (parsed?.moods ?? []),
    genres: ui.genres?.length ? ui.genres : (parsed?.genres ?? []),
    languages: ui.languages?.length ? ui.languages : (parsed?.languages ?? []),
    vocals: ui.vocals ?? parsed?.vocals ?? null,
    instrumental: ui.instrumental ?? parsed?.instrumental ?? null,
    oneStop: ui.oneStop ?? parsed?.oneStop ?? null,
    bpmMin: ui.bpmMin ?? parsed?.bpmMin ?? null,
    bpmMax: ui.bpmMax ?? parsed?.bpmMax ?? null,
  };
  const words = f.text.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter((w) => w.length > 2);
  const tsq = words.length ? words.map((w) => `${w}:*`).join(' | ') : null;
  const genreNorm = sql`lower(translate(w.genre, 'áéíóúãõçÁÉÍÓÚ', 'aeiouaocAEIOU'))`;
  const rows = await deps.db.execute<ItemRow>(sql`
    select ${ITEM_COLS}, ${tsq ? sql`ts_rank(w.search_tsv, to_tsquery('simple', ${tsq}))` : sql`0`} as rank
    from works w
    where ${SYNC_VISIBLE}
      ${f.moods.length ? sql`and w.moods && ${`{${f.moods.join(',')}}`}::text[]` : sql``}
      ${f.genres.length ? sql`and (${sql.join(f.genres.map((g) => sql`${genreNorm} like ${`%${g.toLowerCase()}%`}`), sql` or `)})` : sql``}
      ${f.languages.length ? sql`and w.language = any(${`{${f.languages.join(',')}}`}::text[])` : sql``}
      ${f.vocals && f.vocals !== 'none' ? sql`and w.vocals = ${f.vocals}` : sql``}
      ${f.instrumental || f.vocals === 'none' ? sql`and (w.instrumental_available or w.vocals = 'none')` : sql``}
      ${f.oneStop ? sql`and w.one_stop` : sql``}
      ${f.bpmMin !== null ? sql`and w.bpm >= ${f.bpmMin}` : sql``}
      ${f.bpmMax !== null ? sql`and w.bpm <= ${f.bpmMax}` : sql``}
    order by rank desc, w.created_at desc limit 60`);
  return { filters: f, parser: deps.queryParser.kind, items: rows.map(toItem) };
}

/** D4 · Ficha de obra para el comprador. */
export async function syncWork(deps: Deps, viewerId: string, workId: string) {
  await requireRole(deps, viewerId, 'sync_buyer');
  const [r] = await deps.db.execute<ItemRow>(sql`select ${ITEM_COLS} from works w where w.id = ${workId} and ${SYNC_VISIBLE}`);
  return r ? toItem(r) : null;
}

/** D5 · Cotizador: uso, territorio y plazo → rango referencial. */
export async function quoteLicense(deps: Deps, input: { usage: string; territory: string; termMonths: number; oneStop: boolean }) {
  if (!(LICENSE_USAGES as readonly string[]).includes(input.usage)) throw new DomainError('USAGE_INVALID');
  if (!(TERRITORIES as readonly string[]).includes(input.territory)) throw new DomainError('TERRITORY_INVALID');
  if (!(TERMS as readonly number[]).includes(input.termMonths)) throw new DomainError('TERM_INVALID');
  const today = deps.now().toISOString().slice(0, 10);
  const [rate] = await deps.db.execute<{ id: string; min_cents: string; max_cents: string; currency: string }>(sql`
    select id, min_cents::text, max_cents::text, currency from sync_rate_card
    where usage = ${input.usage}::license_usage and territory = ${input.territory} and term_months = 12 and valid_from <= ${today} and (valid_to is null or valid_to >= ${today})
    order by valid_from desc limit 1`);
  if (!rate) throw new DomainError('RATE_NOT_FOUND');
  const q = quote({ minCents: Number(rate.min_cents), maxCents: Number(rate.max_cents) }, input.termMonths, input.oneStop);
  return { ...q, currency: rate.currency, rateCardId: rate.id, referential: true };
}

async function syncCommissionBps(deps: Deps) {
  const [s] = await deps.db.select({ value: t.settings.value }).from(t.settings).where(eq(t.settings.key, 'sync.commission_bps'));
  return Number(s?.value ?? 3000);
}

/** D6 · Solicitud de licencia: llega a cada autor socio de la obra para aprobarla (criterio 6). */
export async function requestLicense(deps: Deps, buyerId: string, workId: string, input: { usage: string; territory: string; termMonths: number; project: string; oneStop: boolean; briefId?: string | null }, ctx: RequestCtx) {
  const work = await syncWork(deps, buyerId, workId);
  if (!work) throw new DomainError('WORK_NOT_FOUND');
  const buyer = await buyerProfile(deps, buyerId);
  if (!buyer) throw new DomainError('BUYER_PROFILE_REQUIRED');
  const project = input.project.trim();
  if (project.length < 10 || project.length > 2000) throw new DomainError('PROJECT_REQUIRED');
  if (input.oneStop && !work.oneStop) throw new DomainError('ONE_STOP_UNAVAILABLE');
  const q = await quoteLicense(deps, input);
  const approvers = await memberWriters(deps, workId);
  const commission = await syncCommissionBps(deps);
  return withSystem(deps.db, { actorId: buyerId, actorRole: 'sync_buyer', command: 'license.request', ...ctx }, async (tx) => {
    const [r] = await tx
      .insert(t.licenseRequests)
      .values({
        buyerUserId: buyerId, workId, briefId: input.briefId ?? null, usage: input.usage as LicenseUsage, territory: input.territory, termMonths: input.termMonths, projectDescription: project,
        quoteMinCents: q.minCents, quoteMaxCents: q.maxCents, rateCardId: q.rateCardId, oneStopRequested: input.oneStop, status: 'awaiting_writers', plumaCommissionBps: commission, buyerCompany: buyer.company,
      })
      .returning({ id: t.licenseRequests.id });
    if (approvers.length) await tx.insert(t.licenseApprovals).values(approvers.map((w) => ({ licenseRequestId: r!.id, writerUserId: w })));
    if (input.briefId) await tx.update(t.briefSubmissions).set({ status: 'shortlisted' }).where(and(eq(t.briefSubmissions.briefId, input.briefId), eq(t.briefSubmissions.workId, workId)));
    await emit(tx, 'license.requested', 'license_request', r!.id);
    return r!.id;
  });
}

/** A33 · Cada autor socio aprueba o rechaza. Todos aprueban → pasa al operador; uno rechaza → rechazada. */
export async function decideLicense(deps: Deps, writerId: string, requestId: string, approve: boolean, ctx: RequestCtx) {
  await withSystem(deps.db, { actorId: writerId, actorRole: 'writer', command: approve ? 'license.approve' : 'license.reject', ...ctx }, async (tx) => {
    const [r] = await tx.select().from(t.licenseRequests).where(eq(t.licenseRequests.id, requestId)).for('update');
    if (!r) throw new DomainError('NOT_FOUND');
    const [mine] = await tx.select().from(t.licenseApprovals).where(and(eq(t.licenseApprovals.licenseRequestId, requestId), eq(t.licenseApprovals.writerUserId, writerId)));
    if (!mine) throw new DomainError('FORBIDDEN');
    if (r.status !== 'awaiting_writers' || mine.decision) throw new DomainError('LICENSE_NOT_PENDING');
    await tx.update(t.licenseApprovals).set({ decision: approve ? 'approved' : 'rejected', decidedAt: deps.now().toISOString() }).where(and(eq(t.licenseApprovals.licenseRequestId, requestId), eq(t.licenseApprovals.writerUserId, writerId)));
    const all = await tx.select().from(t.licenseApprovals).where(eq(t.licenseApprovals.licenseRequestId, requestId));
    const next = all.some((a) => a.decision === 'rejected') ? 'writers_rejected' : all.every((a) => a.decision === 'approved') ? 'writers_approved' : null;
    if (next) {
      await tx.update(t.licenseRequests).set({ status: next, decidedAt: deps.now().toISOString() }).where(eq(t.licenseRequests.id, requestId));
      await emit(tx, 'license.decided', 'license_request', requestId, { status: next });
    }
  });
}

export async function licensesForWriter(deps: Deps, writerId: string) {
  return deps.db.execute<{ id: string; work_id: string; title: string; company: string | null; usage: string; territory: string; term_months: number; project_description: string; quote_min_cents: string; quote_max_cents: string; one_stop_requested: boolean; status: string; my_decision: string | null; created_at: string; final_fee_cents: string | null }>(sql`
    select r.id, r.work_id, w.title, r.buyer_company as company, r.usage, r.territory, r.term_months, r.project_description, r.quote_min_cents::text, r.quote_max_cents::text,
           r.one_stop_requested, r.status, a.decision as my_decision, r.created_at, r.final_fee_cents::text
    from license_approvals a join license_requests r on r.id = a.license_request_id join works w on w.id = r.work_id
    where a.writer_user_id = ${writerId} order by (r.status = 'awaiting_writers' and a.decision is null) desc, r.created_at desc`);
}

/** D7 · Mis solicitudes (comprador). */
export async function buyerRequests(deps: Deps, buyerId: string) {
  await requireRole(deps, buyerId, 'sync_buyer');
  return deps.db.execute<{ id: string; work_id: string; title: string; usage: string; territory: string; term_months: number; quote_min_cents: string; quote_max_cents: string; status: string; created_at: string; final_fee_cents: string | null; operator_note: string | null }>(sql`
    select r.id, r.work_id, w.title, r.usage, r.territory, r.term_months, r.quote_min_cents::text, r.quote_max_cents::text, r.status, r.created_at, r.final_fee_cents::text, r.operator_note
    from license_requests r join works w on w.id = r.work_id where r.buyer_user_id = ${buyerId} order by r.created_at desc`);
}

/* ---------------------------------- Briefs ---------------------------------- */

export interface BriefInput {
  title: string;
  description: string;
  moods: string[];
  genres: string[];
  languages: string[];
  usage: string;
  territory: string;
  termMonths: number | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  deadline: string | null;
}

/** D8 · Publicar brief (comprador u operador). */
export async function createBrief(deps: Deps, userId: string, input: BriefInput, ctx: RequestCtx) {
  const roles = await rolesOf(deps, userId);
  const staff = roles.find((r) => r === 'operator' || r === 'super_admin');
  if (!staff && !roles.includes('sync_buyer')) throw new DomainError('FORBIDDEN');
  if (input.title.trim().length < 3 || input.description.trim().length < 10) throw new DomainError('BRIEF_INVALID');
  if (!(LICENSE_USAGES as readonly string[]).includes(input.usage)) throw new DomainError('USAGE_INVALID');
  if (!(TERRITORIES as readonly string[]).includes(input.territory)) throw new DomainError('TERRITORY_INVALID');
  const arr = (xs: string[]) => sql`${`{${xs.map((x) => x.trim().replace(/[{},"]/g, '')).filter(Boolean).join(',')}}`}::text[]` as unknown as string[];
  return withSystem(deps.db, { actorId: userId, actorRole: staff ?? 'sync_buyer', command: 'brief.create', ...ctx }, async (tx) => {
    const [b] = await tx
      .insert(t.syncBriefs)
      .values({
        buyerUserId: staff ? null : userId, title: input.title.trim(), description: input.description.trim(), moods: arr(input.moods), genres: arr(input.genres), languages: arr(input.languages),
        usage: input.usage as LicenseUsage, territory: input.territory, termMonths: input.termMonths, budgetMinCents: input.budgetMinCents, budgetMaxCents: input.budgetMaxCents, deadline: input.deadline,
      })
      .returning({ id: t.syncBriefs.id });
    return b!.id;
  });
}

export async function closeBrief(deps: Deps, userId: string, briefId: string, ctx: RequestCtx) {
  const roles = await rolesOf(deps, userId);
  const staff = roles.find((r) => r === 'operator' || r === 'super_admin');
  await withSystem(deps.db, { actorId: userId, actorRole: staff ?? 'sync_buyer', command: 'brief.close', ...ctx }, async (tx) => {
    const [b] = await tx.select().from(t.syncBriefs).where(eq(t.syncBriefs.id, briefId));
    if (!b || (!staff && b.buyerUserId !== userId)) throw new DomainError('FORBIDDEN');
    await tx.update(t.syncBriefs).set({ status: 'closed', closedAt: deps.now().toISOString() }).where(eq(t.syncBriefs.id, briefId));
  });
}

/** Briefs abiertos (autor Pro), con mis obras ya enviadas a cada uno. */
export async function openBriefs(deps: Deps, writerId: string) {
  return deps.db.execute<{ id: string; title: string; description: string; moods: string[]; genres: string[]; languages: string[]; usage: string; territory: string; deadline: string | null; budget_min_cents: string | null; budget_max_cents: string | null; company: string | null; my_works: string[] }>(sql`
    select b.id, b.title, b.description, b.moods, b.genres, b.languages, b.usage, b.territory, b.deadline, b.budget_min_cents::text, b.budget_max_cents::text,
           coalesce(sb.company, 'Pluma Sync') as company,
           coalesce((select array_agg(s.work_id::text) from brief_submissions s where s.brief_id = b.id and s.submitted_by = ${writerId}), '{}') as my_works
    from sync_briefs b left join sync_buyers sb on sb.user_id = b.buyer_user_id
    where b.status = 'open' and (b.deadline is null or b.deadline > now()) order by b.created_at desc`);
}

/** Enviar una obra a un brief con un clic (autor Pro con la obra en el catálogo de sync). */
export async function submitToBrief(deps: Deps, writerId: string, briefId: string, workId: string, note: string, ctx: RequestCtx) {
  const [m] = await deps.db.select({ plan: t.memberships.planCode, status: t.memberships.status }).from(t.memberships).where(eq(t.memberships.userId, writerId));
  if (!m || m.plan !== 'pro' || !['active', 'past_due'].includes(m.status)) throw new DomainError('PLAN_REQUIRES_PRO');
  const [b] = await deps.db.select().from(t.syncBriefs).where(eq(t.syncBriefs.id, briefId));
  if (!b || b.status !== 'open') throw new DomainError('BRIEF_CLOSED');
  const [w] = await deps.db.execute<{ id: string }>(sql`select w.id from works w where w.id = ${workId} and ${SYNC_VISIBLE}`);
  if (!w || !(await memberWriters(deps, workId)).includes(writerId)) throw new DomainError('WORK_NOT_IN_SYNC');
  await withSystem(deps.db, { actorId: writerId, actorRole: 'writer', command: 'brief.submit', ...ctx }, (tx) =>
    tx.insert(t.briefSubmissions).values({ briefId, workId, submittedBy: writerId, note: note.trim().slice(0, 500) || null }).onConflictDoNothing(),
  );
}

/** D8 · Mis briefs con las obras recibidas. */
export async function buyerBriefs(deps: Deps, buyerId: string) {
  await requireRole(deps, buyerId, 'sync_buyer');
  const briefs = await deps.db.select().from(t.syncBriefs).where(eq(t.syncBriefs.buyerUserId, buyerId)).orderBy(desc(t.syncBriefs.createdAt));
  const subs = briefs.length
    ? await deps.db.execute<ItemRow & { brief_id: string; note: string | null; status: string }>(sql`
        select s.brief_id, s.note, s.status, ${ITEM_COLS} from brief_submissions s join works w on w.id = s.work_id
        where s.brief_id = any(${`{${briefs.map((b) => b.id).join(',')}}`}::uuid[]) and ${SYNC_VISIBLE} order by s.created_at desc`)
    : [];
  return briefs.map((b) => ({ ...b, submissions: subs.filter((s) => s.brief_id === b.id).map((s) => ({ ...toItem(s), note: s.note, status: s.status })) }));
}

/* ------------------------- Back-office: licencias (E17) ------------------------- */

export async function listLicensesAdmin(deps: Deps, staffId: string, status?: string) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  return deps.db.execute<{ id: string; title: string; company: string | null; buyer_email: string; usage: string; territory: string; term_months: number; quote_min_cents: string; quote_max_cents: string; status: string; created_at: string; final_fee_cents: string | null; pluma_commission_bps: number | null; project_description: string; approvals: string; one_stop_requested: boolean }>(sql`
    select r.id, w.title, r.buyer_company as company, u.email::text as buyer_email, r.usage, r.territory, r.term_months, r.quote_min_cents::text, r.quote_max_cents::text, r.status, r.created_at,
           r.final_fee_cents::text, r.pluma_commission_bps, r.project_description, r.one_stop_requested,
           (select count(*) filter (where a.decision = 'approved') || '/' || count(*) from license_approvals a where a.license_request_id = r.id) as approvals
    from license_requests r join works w on w.id = r.work_id join users u on u.id = r.buyer_user_id
    where true ${status ? sql`and r.status = ${status}::license_status` : sql``}
    order by r.created_at desc limit 200`);
}

/** E17 · El operador negocia, emite (con tarifa final) o cancela. La emisión exige la aprobación de todos los autores. */
export async function setLicenseStatus(deps: Deps, staffId: string, requestId: string, next: 'negotiating' | 'issued' | 'canceled', input: { finalFeeCents?: number | null; note?: string | null }, ctx: RequestCtx) {
  const roles = await admin.staffRoles(deps, staffId);
  const role = roles.find((r) => r === 'operator' || r === 'super_admin');
  if (!role) throw new DomainError('FORBIDDEN');
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: `license.${next}`, ...ctx }, async (tx) => {
    const [r] = await tx.select().from(t.licenseRequests).where(eq(t.licenseRequests.id, requestId)).for('update');
    if (!r) throw new DomainError('NOT_FOUND');
    const allowed: Record<string, string[]> = { negotiating: ['writers_approved'], issued: ['writers_approved', 'negotiating'], canceled: ['submitted', 'awaiting_writers', 'writers_approved', 'negotiating'] };
    if (!allowed[next]!.includes(r.status)) throw new DomainError('LICENSE_TRANSITION_INVALID');
    if (next === 'issued' && !(input.finalFeeCents && input.finalFeeCents > 0)) throw new DomainError('FEE_REQUIRED');
    await tx
      .update(t.licenseRequests)
      .set({ status: next, operatorId: staffId, operatorNote: input.note?.trim() || r.operatorNote, ...(next === 'issued' ? { finalFeeCents: input.finalFeeCents!, issuedAt: deps.now().toISOString() } : {}) })
      .where(eq(t.licenseRequests.id, requestId));
    await emit(tx, 'license.decided', 'license_request', requestId, { status: next });
  });
}

export async function listBriefsAdmin(deps: Deps, staffId: string) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  return deps.db.execute<{ id: string; title: string; company: string | null; usage: string; territory: string; status: string; created_at: string; submissions: number }>(sql`
    select b.id, b.title, coalesce(sb.company, 'Pluma (operador)') as company, b.usage, b.territory, b.status, b.created_at,
           (select count(*)::int from brief_submissions s where s.brief_id = b.id) as submissions
    from sync_briefs b left join sync_buyers sb on sb.user_id = b.buyer_user_id order by b.created_at desc limit 200`);
}

export async function listArAdmin(deps: Deps, staffId: string) {
  if (!(await admin.staffRoles(deps, staffId)).length) throw new DomainError('FORBIDDEN');
  const invitations = await deps.db.select().from(t.arInvitations).orderBy(desc(t.arInvitations.createdAt)).limit(200);
  const holds = await deps.db.execute<{ id: string; title: string; company: string | null; status: string; duration_days: number; ends_at: string | null; created_at: string }>(sql`
    select h.id, w.title, (select i.company from ar_invitations i where i.accepted_user_id = h.requester_user_id order by i.created_at desc limit 1) as company,
           h.status, h.duration_days, h.ends_at, h.created_at
    from holds h join works w on w.id = h.work_id order by h.created_at desc limit 200`);
  return { invitations, holds };
}

import { and, desc, eq, inArray, ne, t, withSystem, withUser, sql, type Tx } from '@pluma/db';
import {
  BPS_TOTAL,
  DomainError,
  assertFeature,
  assertTransition,
  canonicalSplitSheet,
  detectConflicts,
  isValidIsrc,
  isValidEmail,
  normalizeIsrc,
  normalizeTitle,
  validateSplit,
  versionStatusFromShares,
  type DraftShare,
  type WorkStatus,
  type WriterRole,
  WRITER_ROLES,
} from '@pluma/domain';
import { guestSignToken, sha256 } from './crypto';
import type { Deps, RequestCtx } from './deps';
import { emit } from './events';
import { PUBLISHER_ID } from './onboarding';

const INVITE_TTL_DAYS = 14;
const DAY = 86_400_000;
const AI = ['none', 'ai_assisted', 'ai_generated'] as const;

export interface WorkInput {
  title: string;
  altTitles: string[];
  language: string;
  genre: string;
  lyrics: string | null;
  aiDeclaration: (typeof AI)[number];
  isrcs: string[];
}

export type ShareInput =
  | { kind: 'member'; userId: string; role: WriterRole; bps: number }
  | { kind: 'external'; name: string; email: string; ipi?: string | null; society?: string | null; role: WriterRole; bps: number };

/** Literal de arreglo de Postgres (Drizzle expande los arreglos de JS como listas de parámetros). */
const pgTextArray = (xs: string[]) => `{${xs.map((x) => `"${x.replace(/["\\]/g, '\\$&')}"`).join(',')}}`;

const normalizeLyrics = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).join('\n').trim();

function validateWorkInput(input: WorkInput) {
  if (input.title.trim().length < 1 || input.title.length > 200) throw new DomainError('TITLE_REQUIRED');
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(input.language)) throw new DomainError('LANGUAGE_REQUIRED');
  if (!input.genre.trim()) throw new DomainError('GENRE_REQUIRED');
  if (!AI.includes(input.aiDeclaration)) throw new DomainError('AI_DECLARATION_REQUIRED');
  for (const i of input.isrcs) if (!isValidIsrc(i)) throw new DomainError('ISRC_INVALID', { isrc: i });
}

const ctxOf = (userId: string, command: string, ctx: RequestCtx) => ({ actorId: userId, actorRole: 'writer' as const, command, ...ctx });

async function requireActiveMember(tx: Tx, userId: string) {
  const [m] = await tx.select().from(t.memberships).where(eq(t.memberships.userId, userId));
  if (!m || !['active', 'past_due'].includes(m.status)) throw new DomainError('MEMBERSHIP_INACTIVE');
  return m;
}

async function setStatus(tx: Tx, workId: string, from: WorkStatus, to: WorkStatus, actorId: string | null, note?: string) {
  if (from === to) return;
  assertTransition(from, to);
  await tx.update(t.works).set({ status: to }).where(eq(t.works.id, workId));
  await tx.insert(t.workStatusHistory).values({ workId, fromStatus: from, toStatus: to, actorId, note });
  if (to === 'sent_to_publisher' || to === 'registered' || to === 'disputed') await emit(tx, 'work.status_changed', 'work', workId, { from, to });
}

async function loadOwnedWork(tx: Tx, userId: string, workId: string) {
  const [w] = await tx.select().from(t.works).where(eq(t.works.id, workId));
  if (!w) throw new DomainError('WORK_NOT_FOUND');
  if (w.createdBy !== userId) throw new DomainError('FORBIDDEN');
  return w;
}

/** Registro de obra (A22–A23): queda en Borrador con el creador al 100 % hasta que defina coautores. */
export async function createWork(deps: Deps, userId: string, input: WorkInput, ctx: RequestCtx): Promise<string> {
  validateWorkInput(input);
  return withSystem(deps.db, ctxOf(userId, 'work.create', ctx), async (tx) => {
    await requireActiveMember(tx, userId);
    const lyrics = input.lyrics?.trim() ? normalizeLyrics(input.lyrics) : null;
    const [w] = await tx
      .insert(t.works)
      .values({
        publisherId: PUBLISHER_ID,
        title: input.title.trim(),
        titleNormalized: normalizeTitle(input.title),
        altTitles: input.altTitles.map((s) => s.trim()).filter(Boolean),
        language: input.language,
        genre: input.genre.trim(),
        lyrics,
        lyricsSha256: lyrics ? sha256(lyrics) : null,
        aiDeclaration: input.aiDeclaration,
        createdBy: userId,
      })
      .returning({ id: t.works.id });
    const workId = w!.id;
    for (const isrc of new Set(input.isrcs.map(normalizeIsrc))) {
      await tx.insert(t.recordings).values({ workId, isrc, title: input.title.trim(), artist: '—' });
    }
    const [v] = await tx.insert(t.splitVersions).values({ workId, version: 1, createdBy: userId }).returning({ id: t.splitVersions.id });
    await tx.insert(t.splitShares).values({ splitVersionId: v!.id, writerUserId: userId, role: 'composer_lyricist', shareBps: BPS_TOTAL, administered: true });
    await tx.insert(t.workStatusHistory).values({ workId, fromStatus: null, toStatus: 'draft', actorId: userId });
    await emit(tx, 'work.created', 'work', workId);
    await emit(tx, 'work.authorship_changed', 'work', workId);
    return workId;
  });
}

export async function updateWorkDraft(deps: Deps, userId: string, workId: string, input: WorkInput, ctx: RequestCtx) {
  validateWorkInput(input);
  await withSystem(deps.db, ctxOf(userId, 'work.update', ctx), async (tx) => {
    const w = await loadOwnedWork(tx, userId, workId);
    if (w.status !== 'draft') throw new DomainError('WORK_NOT_EDITABLE');
    const lyrics = input.lyrics?.trim() ? normalizeLyrics(input.lyrics) : null;
    await tx
      .update(t.works)
      .set({ title: input.title.trim(), titleNormalized: normalizeTitle(input.title), altTitles: input.altTitles.filter(Boolean), language: input.language, genre: input.genre.trim(), lyrics, lyricsSha256: lyrics ? sha256(lyrics) : null, aiDeclaration: input.aiDeclaration })
      .where(eq(t.works.id, workId));
    await tx.delete(t.recordings).where(eq(t.recordings.workId, workId));
    for (const isrc of new Set(input.isrcs.map(normalizeIsrc))) await tx.insert(t.recordings).values({ workId, isrc, title: input.title.trim(), artist: '—' });
    if (lyrics !== w.lyrics) await emit(tx, 'work.authorship_changed', 'work', workId);
  });
}

const AUDIO_TYPES: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/flac': 'flac' };
export const MAX_DEMO_BYTES = 40 * 1024 * 1024;

/** Demo de audio: se guarda el original (nunca se sirve fuera del back-office) y su hash entra en la prueba de autoría. */
export async function attachDemo(deps: Deps, userId: string, workId: string, file: { bytes: Buffer; mime: string }, ctx: RequestCtx) {
  const ext = AUDIO_TYPES[file.mime];
  if (!ext) throw new DomainError('AUDIO_TYPE_UNSUPPORTED');
  if (file.bytes.length === 0 || file.bytes.length > MAX_DEMO_BYTES) throw new DomainError('AUDIO_TOO_LARGE');
  const hash = sha256(file.bytes);
  const path = `${workId}/${hash}.${ext}`;
  const [w] = await deps.db.select().from(t.works).where(eq(t.works.id, workId));
  if (!w) throw new DomainError('WORK_NOT_FOUND');
  if (w.createdBy !== userId) throw new DomainError('FORBIDDEN');
  if (w.audioSha256 === hash) return;
  await deps.storage.putOnce('audio-originals', path, file.bytes, file.mime).catch((e: Error) => {
    if (e.message !== 'OBJECT_EXISTS') throw e;
  });
  await withSystem(deps.db, ctxOf(userId, 'work.attach_demo', ctx), async (tx) => {
    await tx.insert(t.workFiles).values({ workId, ownerUserId: userId, kind: 'demo_original', storagePath: `audio-originals/${path}`, sha256: hash }).onConflictDoNothing();
    if (w.status === 'draft' || !w.audioSha256) {
      await tx.update(t.works).set({ audioSha256: hash }).where(eq(t.works.id, workId));
      await emit(tx, 'work.authorship_changed', 'work', workId);
    }
  });
}

/** Sella con RFC 3161 el hash de autoría (audio + letra + título). Lo ejecuta el worker. */
export async function sealAuthorship(deps: Deps, workId: string) {
  const [w] = await deps.db.select().from(t.works).where(eq(t.works.id, workId));
  if (!w) return null;
  const digest = sha256(`pluma-authorship-v1|${w.id}|${w.titleNormalized}|${w.audioSha256 ?? '-'}|${w.lyricsSha256 ?? '-'}`);
  const token = await deps.tsa.stamp(digest);
  await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'work.seal_authorship' }, (tx) =>
    tx.update(t.works).set({ authorshipSealedAt: deps.now().toISOString(), authorshipTsaToken: token ?? undefined }).where(eq(t.works.id, workId)),
  );
  return digest;
}

/** Versión editable: la última en borrador; si la última está firmada o rechazada, hay que proponer una nueva. */
async function draftVersion(tx: Tx, workId: string) {
  const [v] = await tx.select().from(t.splitVersions).where(eq(t.splitVersions.workId, workId)).orderBy(desc(t.splitVersions.version)).limit(1);
  if (!v || v.status !== 'draft') throw new DomainError('NO_DRAFT_VERSION');
  return v;
}

/** Busca socios por correo exacto (para agregarlos como coautores administrados). */
export async function findMemberByEmail(deps: Deps, email: string) {
  const rows = await deps.db
    .select({ userId: t.users.id, legalName: t.writerProfiles.legalName, artistName: t.writerProfiles.artistName })
    .from(t.users)
    .innerJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.users.id))
    .where(eq(t.users.email, email.trim().toLowerCase()));
  return rows[0] ?? null;
}

/** Guarda los coautores del borrador (A24). La suma se valida al enviar, no al guardar. */
export async function setDraftSplit(deps: Deps, userId: string, workId: string, shares: ShareInput[], ctx: RequestCtx) {
  if (shares.length === 0 || shares.length > 20) throw new DomainError('SPLIT_PARTIES_INVALID');
  for (const s of shares) {
    if (!WRITER_ROLES.includes(s.role)) throw new DomainError('ROLE_INVALID');
    if (!Number.isInteger(s.bps) || s.bps <= 0 || s.bps > BPS_TOTAL) throw new DomainError('SHARE_INVALID');
    if (s.kind === 'external' && !isValidEmail(s.email)) throw new DomainError('EMAIL_INVALID');
  }
  // Un correo que pertenece a un socio se convierte en participación administrada.
  const resolved: ShareInput[] = [];
  for (const s of shares) {
    if (s.kind === 'external') {
      const m = await findMemberByEmail(deps, s.email);
      resolved.push(m ? { kind: 'member', userId: m.userId, role: s.role, bps: s.bps } : { ...s, email: s.email.trim().toLowerCase(), name: s.name.trim() });
    } else resolved.push(s);
  }
  const v = validateSplit(resolved.map(toDraftShare), userId);
  const blocking = v.issues.filter((i) => i.code !== 'TOTAL_NOT_100');
  if (blocking.length) throw new DomainError('SPLIT_INVALID', { issues: blocking });

  await withSystem(deps.db, ctxOf(userId, 'split.edit_draft', ctx), async (tx) => {
    await loadOwnedWork(tx, userId, workId);
    const version = await draftVersion(tx, workId);
    await tx.delete(t.splitShares).where(eq(t.splitShares.splitVersionId, version.id));
    for (const s of resolved) {
      await tx.insert(t.splitShares).values(
        s.kind === 'member'
          ? { splitVersionId: version.id, writerUserId: s.userId, role: s.role, shareBps: s.bps, administered: true }
          : { splitVersionId: version.id, externalName: s.name, externalEmail: s.email, externalIpi: s.ipi ?? null, externalSociety: s.society ?? null, role: s.role, shareBps: s.bps, administered: false },
      );
    }
  });
}

const toDraftShare = (s: ShareInput): DraftShare =>
  s.kind === 'member' ? { party: { kind: 'member', userId: s.userId }, role: s.role, bps: s.bps } : { party: { kind: 'external', name: s.name, email: s.email }, role: s.role, bps: s.bps };

type ShareRow = typeof t.splitShares.$inferSelect;

export async function partiesFor(tx: Tx, shares: ShareRow[]) {
  const memberIds = shares.map((s) => s.writerUserId).filter((x): x is string => !!x);
  const profiles = memberIds.length
    ? await tx
        .select({ userId: t.writerProfiles.userId, legalName: t.writerProfiles.legalName, artistName: t.writerProfiles.artistName, ipi: t.writerProfiles.ipi, society: t.writerProfiles.societyCode, email: t.users.email, locale: t.users.locale })
        .from(t.writerProfiles)
        .innerJoin(t.users, eq(t.users.id, t.writerProfiles.userId))
        .where(inArray(t.writerProfiles.userId, memberIds))
    : [];
  const byId = new Map(profiles.map((p) => [p.userId, p]));
  return shares.map((s) => {
    const p = s.writerUserId ? byId.get(s.writerUserId) : undefined;
    return {
      share: s,
      name: p ? p.legalName : (s.externalName ?? ''),
      displayName: p ? (p.artistName || p.legalName) : (s.externalName ?? ''),
      email: p ? p.email : (s.externalEmail ?? ''),
      locale: p?.locale ?? null,
      ipi: p ? p.ipi : (s.externalIpi ?? null),
      society: p ? p.society : (s.externalSociety ?? null),
    };
  });
}

export async function signatureFor(tx: Tx, args: { sha: string; versionId: string; userId: string | null; name: string; email: string; method: string; verifiedAt: string; ctx: RequestCtx }) {
  const [sig] = await tx
    .insert(t.signatures)
    .values({ documentSha256: args.sha, documentKind: 'split_sheet', documentRef: args.versionId, signerUserId: args.userId, signerName: args.name, signerEmail: args.email, method: args.method, otpVerifiedAt: args.verifiedAt, ip: args.ctx.ip ?? '0.0.0.0', userAgent: args.ctx.userAgent ?? 'unknown' })
    .returning({ id: t.signatures.id });
  return sig!.id;
}

async function resolveSignedStatus(tx: Tx, work: typeof t.works.$inferSelect): Promise<WorkStatus> {
  if (work.publisherWorkCode) return 'registered';
  const [sub] = await tx.select({ id: t.publisherSubmissions.id }).from(t.publisherSubmissions).where(sql`${work.id}::uuid = any(${t.publisherSubmissions.workIds})`).limit(1);
  return sub ? 'sent_to_publisher' : 'splits_signed';
}

/** Tras cada firma: si todos firmaron, la versión entra en vigor y la obra avanza a registro. */
export async function afterSignature(deps: Deps, tx: Tx, versionId: string, signerName: string) {
  const [version] = await tx.select().from(t.splitVersions).where(eq(t.splitVersions.id, versionId));
  const shares = await tx.select().from(t.splitShares).where(eq(t.splitShares.splitVersionId, versionId));
  const status = versionStatusFromShares(shares.map((s) => s.status));
  const signed = shares.filter((s) => s.status === 'signed').length;
  if (status !== 'signed') {
    await emit(tx, 'split.signed', 'split_version', versionId, { workId: version!.workId, signerName, signed, total: shares.length });
    return;
  }
  const now = deps.now();
  await tx
    .update(t.splitVersions)
    .set({ status: 'superseded' })
    .where(and(eq(t.splitVersions.workId, version!.workId), eq(t.splitVersions.status, 'signed'), ne(t.splitVersions.id, versionId)));
  await tx.update(t.splitVersions).set({ status: 'signed', completedAt: now.toISOString(), effectiveFrom: now.toISOString().slice(0, 10) }).where(eq(t.splitVersions.id, versionId));
  const [work] = await tx.select().from(t.works).where(eq(t.works.id, version!.workId));
  if (work!.status === 'awaiting_signatures' || work!.status === 'draft') {
    await setStatus(tx, work!.id, work!.status, await resolveSignedStatus(tx, work!), null, `split v${version!.version} firmado`);
  }
  await emit(tx, 'split.completed', 'split_version', versionId, { workId: version!.workId });
}

/**
 * Envía la versión borrador a firma (criterio 2): exige 100 %, congela el documento con su hash,
 * firma la parte del creador e invita al resto. Solo pasa a registro cuando todos firman.
 */
export async function submitForSignatures(deps: Deps, userId: string, workId: string, ctx: RequestCtx) {
  const now = deps.now();
  const result = await withSystem(deps.db, ctxOf(userId, 'split.submit', ctx), async (tx) => {
    const work = await loadOwnedWork(tx, userId, workId);
    await requireActiveMember(tx, userId);
    const version = await draftVersion(tx, workId);
    const shares = await tx.select().from(t.splitShares).where(eq(t.splitShares.splitVersionId, version.id));
    const check = validateSplit(
      shares.map((s) => (s.writerUserId ? { party: { kind: 'member', userId: s.writerUserId }, role: s.role, bps: s.shareBps } : { party: { kind: 'external', name: s.externalName ?? '', email: s.externalEmail ?? '' }, role: s.role, bps: s.shareBps })),
      userId,
    );
    if (!check.ok) throw new DomainError('SPLIT_INVALID', { issues: check.issues, remainingBps: check.remainingBps });

    // Solo se administra la parte de socios con membresía vigente.
    const memberIds = shares.map((s) => s.writerUserId).filter((x): x is string => !!x);
    const active = new Set(
      (await tx.select({ userId: t.memberships.userId }).from(t.memberships).where(and(inArray(t.memberships.userId, memberIds), inArray(t.memberships.status, ['active', 'past_due'])))).map((r) => r.userId),
    );
    for (const s of shares) {
      const administered = !!s.writerUserId && active.has(s.writerUserId);
      if (administered !== s.administered) await tx.update(t.splitShares).set({ administered }).where(eq(t.splitShares.id, s.id));
      s.administered = administered;
    }

    const parties = await partiesFor(tx, shares);
    const sheet = canonicalSplitSheet({
      workId,
      title: work.title,
      altTitles: work.altTitles,
      language: work.language,
      version: version.version,
      createdAt: now.toISOString(),
      parties: parties.map((p) => ({ name: p.name, email: p.email, ipi: p.ipi, society: p.society, role: p.share.role, bps: p.share.shareBps, administered: p.share.administered })),
    });
    const sheetSha = sha256(sheet);
    await deps.storage.putOnce('documents', `split-sheets/${workId}/v${version.version}-${sheetSha}.txt`, Buffer.from(sheet), 'text/plain; charset=utf-8').catch((e: Error) => {
      if (e.message !== 'OBJECT_EXISTS') throw e;
    });

    await tx.update(t.splitVersions).set({ splitSheetSha256: sheetSha, evidencePath: `documents/split-sheets/${workId}/v${version.version}-${sheetSha}.txt`, submittedAt: now.toISOString() }).where(eq(t.splitVersions.id, version.id));
    const invitedAt = now.toISOString();
    const expires = new Date(now.getTime() + INVITE_TTL_DAYS * DAY).toISOString();
    for (const s of shares) {
      await tx
        .update(t.splitShares)
        .set({ invitedAt, signTokenHash: s.writerUserId ? null : sha256(guestSignToken(deps.signingSecret, s.id, invitedAt)), signTokenExpiresAt: expires })
        .where(eq(t.splitShares.id, s.id));
    }
    // El trigger de la base vuelve a verificar que la suma sea exactamente 10000.
    await tx.update(t.splitVersions).set({ status: 'pending_signatures' }).where(eq(t.splitVersions.id, version.id));

    const hasSigned = (await tx.select({ id: t.splitVersions.id }).from(t.splitVersions).where(and(eq(t.splitVersions.workId, workId), inArray(t.splitVersions.status, ['signed', 'superseded']))).limit(1)).length > 0;
    if (!hasSigned && (work.status === 'draft' || work.status === 'disputed')) await setStatus(tx, workId, work.status, 'awaiting_signatures', userId);

    // El creador firma al enviar.
    const me = parties.find((p) => p.share.writerUserId === userId)!;
    const [u] = await tx.select().from(t.users).where(eq(t.users.id, userId));
    const sigId = await signatureFor(tx, { sha: sheetSha, versionId: version.id, userId, name: me.name, email: me.email, method: 'session', verifiedAt: u?.emailVerifiedAt ?? now.toISOString(), ctx });
    await tx.update(t.splitShares).set({ status: 'signed', signedAt: now.toISOString(), signatureId: sigId }).where(eq(t.splitShares.id, me.share.id));

    for (const s of shares) if (s.id !== me.share.id) await emit(tx, 'split.invitation', 'split_share', s.id, { workId, versionId: version.id });
    await afterSignature(deps, tx, version.id, me.displayName);
    return { versionId: version.id, sheetSha };
  });
  await detectAndRecordConflicts(deps, workId);
  return result;
}

export async function signableShare(tx: Tx, shareId: string, now: Date) {
  const [share] = await tx.select().from(t.splitShares).where(eq(t.splitShares.id, shareId)).for('update');
  if (!share) throw new DomainError('SHARE_NOT_FOUND');
  const [version] = await tx.select().from(t.splitVersions).where(eq(t.splitVersions.id, share.splitVersionId));
  if (version!.status !== 'pending_signatures') throw new DomainError('VERSION_NOT_PENDING');
  if (share.status !== 'pending') throw new DomainError('SHARE_ALREADY_DECIDED');
  if (share.signTokenExpiresAt && new Date(share.signTokenExpiresAt) < now) throw new DomainError('INVITATION_EXPIRED');
  return { share, version: version! };
}

/** Un coautor socio firma su parte desde la app (A29). */
export async function signAsMember(deps: Deps, userId: string, shareId: string, ctx: RequestCtx) {
  await withSystem(deps.db, ctxOf(userId, 'split.sign', ctx), async (tx) => {
    const now = deps.now();
    const { share, version } = await signableShare(tx, shareId, now);
    if (share.writerUserId !== userId) throw new DomainError('FORBIDDEN');
    const [p] = await partiesFor(tx, [share]);
    const [u] = await tx.select().from(t.users).where(eq(t.users.id, userId));
    const sigId = await signatureFor(tx, { sha: version.splitSheetSha256!, versionId: version.id, userId, name: p!.name, email: p!.email, method: 'session', verifiedAt: u?.emailVerifiedAt ?? now.toISOString(), ctx });
    await tx.update(t.splitShares).set({ status: 'signed', signedAt: now.toISOString(), signatureId: sigId }).where(eq(t.splitShares.id, share.id));
    await afterSignature(deps, tx, version.id, p!.displayName);
  });
}

/** Reclamo: la versión se rechaza, la obra pasa a "En disputa" y sus pagos se retienen. */
export async function rejectShareTx(deps: Deps, tx: Tx, shareId: string, reason: string, actor: { userId: string | null; email: string; name: string }) {
  const now = deps.now();
  const { share, version } = await signableShare(tx, shareId, now);
  if (reason.trim().length < 5) throw new DomainError('REASON_REQUIRED');
  await tx.update(t.splitShares).set({ status: 'rejected' }).where(eq(t.splitShares.id, share.id));
  await tx.update(t.splitVersions).set({ status: 'rejected' }).where(eq(t.splitVersions.id, version.id));
  const [work] = await tx.select().from(t.works).where(eq(t.works.id, version.workId));
  await tx.insert(t.disputes).values({ workId: version.workId, splitVersionId: version.id, raisedByUserId: actor.userId, raisedByEmail: actor.email, reason: reason.trim() });
  if (work!.status !== 'disputed') await setStatus(tx, work!.id, work!.status, 'disputed', actor.userId, 'reclamo de split');
  await emit(tx, 'split.rejected', 'split_version', version.id, { workId: version.workId, signerName: actor.name, reason: reason.trim() });
}

export async function rejectAsMember(deps: Deps, userId: string, shareId: string, reason: string, ctx: RequestCtx) {
  await withSystem(deps.db, ctxOf(userId, 'split.reject', ctx), async (tx) => {
    const [share] = await tx.select().from(t.splitShares).where(eq(t.splitShares.id, shareId));
    if (!share || share.writerUserId !== userId) throw new DomainError('FORBIDDEN');
    const [p] = await partiesFor(tx, [share]);
    await rejectShareTx(deps, tx, shareId, reason, { userId, email: p!.email, name: p!.displayName });
  });
}

/** Cambiar splits de una obra ya firmada o rechazada: nueva versión que exige la firma de todos (A28). */
export async function proposeNewVersion(deps: Deps, userId: string, workId: string, reason: string, ctx: RequestCtx) {
  return withSystem(deps.db, ctxOf(userId, 'split.new_version', ctx), async (tx) => {
    await loadOwnedWork(tx, userId, workId);
    const [last] = await tx.select().from(t.splitVersions).where(eq(t.splitVersions.workId, workId)).orderBy(desc(t.splitVersions.version)).limit(1);
    if (!last || !['signed', 'rejected'].includes(last.status)) throw new DomainError('VERSION_IN_PROGRESS');
    const shares = await tx.select().from(t.splitShares).where(eq(t.splitShares.splitVersionId, last.id));
    const [v] = await tx.insert(t.splitVersions).values({ workId, version: last.version + 1, createdBy: userId, changeReason: reason.trim() || null }).returning({ id: t.splitVersions.id });
    for (const s of shares) {
      await tx.insert(t.splitShares).values({ splitVersionId: v!.id, writerUserId: s.writerUserId, externalName: s.externalName, externalEmail: s.externalEmail, externalIpi: s.externalIpi, externalSociety: s.externalSociety, role: s.role, shareBps: s.shareBps, administered: s.administered });
    }
    return v!.id;
  });
}

/** Opt-ins de catálogo (A31). Socio: bloqueado con invitación a mejorar (criterio 1). */
export async function setCatalogOptIns(deps: Deps, userId: string, workId: string, opts: { sync?: boolean; ar?: boolean; oneStop?: boolean }, ctx: RequestCtx) {
  await withSystem(deps.db, ctxOf(userId, 'work.catalog_opt_in', ctx), async (tx) => {
    const w = await loadOwnedWork(tx, userId, workId);
    const m = await requireActiveMember(tx, userId);
    const snapshot = { plan: m.planCode, status: m.status, currentPeriodEnd: m.currentPeriodEnd ? new Date(m.currentPeriodEnd) : null };
    if (opts.sync && !w.syncOptIn) assertFeature(snapshot, 'sync', deps.now());
    if (opts.ar && !w.arOptIn) assertFeature(snapshot, 'ar', deps.now());
    await tx
      .update(t.works)
      .set({ syncOptIn: opts.sync ?? w.syncOptIn, arOptIn: opts.ar ?? w.arOptIn, oneStop: opts.oneStop ?? w.oneStop })
      .where(eq(t.works.id, workId));
  });
  // Al entrar a un catálogo se prepara la versión de escucha protegida (marca de agua si hay ffmpeg).
  if (opts.sync || opts.ar) {
    const { prepareCatalogAudio } = await import('./catalog');
    await prepareCatalogAudio(deps, workId);
  }
}

/** Alerta si otra persona ya registró una obra con título, grabación, ISWC o audio muy parecidos. */
export async function detectAndRecordConflicts(deps: Deps, workId: string) {
  const [w] = await deps.db.select().from(t.works).where(eq(t.works.id, workId));
  if (!w) return [];
  const isrcs = (await deps.db.select({ isrc: t.recordings.isrc }).from(t.recordings).where(eq(t.recordings.workId, workId))).map((r) => r.isrc);
  const candidates = await deps.db.execute<{ id: string; created_by: string; title: string; iswc: string | null; audio_sha256: string | null; isrcs: string[] }>(sql`
    select w.id, w.created_by, w.title, w.iswc, w.audio_sha256, coalesce(array_agg(r.isrc) filter (where r.isrc is not null), '{}') as isrcs
    from works w left join recordings r on r.work_id = w.id
    where w.created_by <> ${w.createdBy} and w.status <> 'draft'
      and (extensions.similarity(w.title_normalized, ${w.titleNormalized}) > 0.3
           or r.isrc = any(${pgTextArray(isrcs)}::text[])
           or (${w.audioSha256}::text is not null and w.audio_sha256 = ${w.audioSha256})
           or (${w.iswc}::text is not null and w.iswc = ${w.iswc}))
    group by w.id limit 50`);
  const found = detectConflicts(
    { ownerId: w.createdBy, title: w.title, isrcs, iswc: w.iswc, audioSha256: w.audioSha256 },
    candidates.map((c) => ({ workId: c.id, ownerId: c.created_by, title: c.title, isrcs: c.isrcs, iswc: c.iswc, audioSha256: c.audio_sha256 })),
  );
  if (found.length) {
    await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'work.detect_conflicts' }, async (tx) => {
      for (const c of found) {
        const exists = await tx.select({ id: t.workConflicts.id }).from(t.workConflicts).where(and(eq(t.workConflicts.workId, workId), eq(t.workConflicts.conflictingWorkId, c.workId)));
        if (exists.length) continue;
        await tx.insert(t.workConflicts).values({ workId, conflictingWorkId: c.workId, reason: c.reason, score: c.score.toFixed(3) });
      }
      await emit(tx, 'work.conflict_detected', 'work', workId, { count: found.length });
    });
  }
  return found;
}

/* ----------------------------- Lecturas (RLS) ----------------------------- */

export interface WorkListItem {
  id: string;
  title: string;
  status: WorkStatus;
  myBps: number | null;
  authors: number;
  pendingSignatures: number;
  updatedAt: string;
  syncOptIn: boolean;
}

/** Lista de obras del autor (A21), leída con RLS. */
export async function listMyWorks(deps: Deps, userId: string): Promise<WorkListItem[]> {
  return withUser(deps.db, userId, async (tx) => {
    const rows = await tx.execute<{ id: string; title: string; status: WorkStatus; updated_at: string; my_bps: number | null; authors: number; pending: number; sync_opt_in: boolean }>(sql`
      with latest as (
        select distinct on (sv.work_id) sv.work_id, sv.id
        from split_versions sv
        order by sv.work_id, (sv.status in ('signed')) desc, sv.version desc
      )
      select w.id, w.title, w.status, w.updated_at, w.sync_opt_in and not w.opt_ins_suspended as sync_opt_in,
        (select ss.share_bps from split_shares ss where ss.split_version_id = l.id and ss.writer_user_id = ${userId} limit 1) as my_bps,
        (select count(*)::int from split_shares ss where ss.split_version_id = l.id) as authors,
        (select count(*)::int from split_versions pv join split_shares ps on ps.split_version_id = pv.id
          where pv.work_id = w.id and pv.status = 'pending_signatures' and ps.status = 'pending') as pending
      from works w left join latest l on l.work_id = w.id
      order by w.updated_at desc`);
    return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, myBps: r.my_bps, authors: r.authors, pendingSignatures: r.pending, updatedAt: r.updated_at, syncOptIn: r.sync_opt_in }));
  });
}

/** Detalle de obra (A26–A27): RLS decide si la persona puede verla; los nombres de coautores se completan después. */
export async function getWorkDetail(deps: Deps, userId: string, workId: string) {
  const visible = await withUser(deps.db, userId, (tx) => tx.select({ id: t.works.id }).from(t.works).where(eq(t.works.id, workId)));
  if (!visible.length) return null;
  const db = deps.db;
  const [work] = await db.select().from(t.works).where(eq(t.works.id, workId));
  const versions = await db.select().from(t.splitVersions).where(eq(t.splitVersions.workId, workId)).orderBy(desc(t.splitVersions.version));
  const shares = versions.length ? await db.select().from(t.splitShares).where(inArray(t.splitShares.splitVersionId, versions.map((v) => v.id))) : [];
  const parties = await db.transaction((tx) => partiesFor(tx, shares));
  const [recordings, history, files, disputes, conflicts] = await Promise.all([
    db.select().from(t.recordings).where(eq(t.recordings.workId, workId)),
    db.select().from(t.workStatusHistory).where(eq(t.workStatusHistory.workId, workId)).orderBy(t.workStatusHistory.at),
    db.select({ id: t.workFiles.id, kind: t.workFiles.kind, sha256: t.workFiles.sha256, createdAt: t.workFiles.createdAt }).from(t.workFiles).where(eq(t.workFiles.workId, workId)),
    db.select().from(t.disputes).where(eq(t.disputes.workId, workId)).orderBy(desc(t.disputes.openedAt)),
    work!.createdBy === userId ? db.select().from(t.workConflicts).where(and(eq(t.workConflicts.workId, workId), eq(t.workConflicts.status, 'open'))) : Promise.resolve([]),
  ]);
  const [membership] = await db.select().from(t.memberships).where(eq(t.memberships.userId, work!.createdBy));
  return {
    work: { ...work!, authorshipTsaToken: undefined, hasTsaToken: !!work!.authorshipTsaToken },
    isOwner: work!.createdBy === userId,
    ownerPlan: membership?.planCode ?? null,
    versions: versions.map((v) => ({
      ...v,
      parties: parties
        .filter((p) => p.share.splitVersionId === v.id)
        .sort((a, b) => b.share.shareBps - a.share.shareBps)
        .map((p) => ({
          shareId: p.share.id,
          isMe: p.share.writerUserId === userId,
          isMember: !!p.share.writerUserId,
          displayName: p.displayName,
          email: p.share.writerUserId === userId || work!.createdBy === userId ? p.email : null,
          role: p.share.role,
          bps: p.share.shareBps,
          administered: p.share.administered,
          status: p.share.status,
          signedAt: p.share.signedAt,
          invitedAt: p.share.invitedAt,
        })),
    })),
    recordings,
    history,
    files,
    disputes,
    conflicts,
  };
}

export type WorkDetail = NonNullable<Awaited<ReturnType<typeof getWorkDetail>>>;

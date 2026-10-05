import { and, eq, t, withSystem } from '@pluma/db';
import { DomainError, formatBps } from '@pluma/domain';
import { renderEmail } from '@pluma/emails';
import { consumeChallenge, createChallenge } from './challenges';
import { sha256 } from './crypto';
import type { Deps, RequestCtx } from './deps';
import { intlLocale, type AppLocale } from './format';
import { afterSignature, partiesFor, rejectShareTx, signableShare, signatureFor } from './works';

/** Busca la participación por el hash del token del enlace. */
async function shareByToken(deps: Deps, token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [share] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.signTokenHash, sha256(token)));
  return share ?? null;
}

export type GuestInvitation = NonNullable<Awaited<ReturnType<typeof getGuestInvitation>>>;

/** Lo que ve el coautor invitado al abrir el enlace (B1). Sin cuenta y sin datos de contacto de nadie. */
export async function getGuestInvitation(deps: Deps, token: string) {
  const share = await shareByToken(deps, token);
  if (!share) return null;
  const [version] = await deps.db.select().from(t.splitVersions).where(eq(t.splitVersions.id, share.splitVersionId));
  const [work] = await deps.db.select().from(t.works).where(eq(t.works.id, version!.workId));
  const [creator] = await deps.db
    .select({ legalName: t.writerProfiles.legalName, artistName: t.writerProfiles.artistName, locale: t.users.locale })
    .from(t.writerProfiles)
    .innerJoin(t.users, eq(t.users.id, t.writerProfiles.userId))
    .where(eq(t.writerProfiles.userId, work!.createdBy));
  const all = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.splitVersionId, version!.id));
  const parties = await deps.db.transaction((tx) => partiesFor(tx, all));
  const expired = !!share.signTokenExpiresAt && new Date(share.signTokenExpiresAt) < deps.now();
  return {
    shareId: share.id,
    state: share.status !== 'pending' ? share.status : version!.status !== 'pending_signatures' ? 'closed' : expired ? 'expired' : 'open',
    workTitle: work!.title,
    altTitles: work!.altTitles,
    version: version!.version,
    inviterName: creator?.artistName || creator?.legalName || 'Pluma',
    creatorLocale: (creator?.locale ?? 'es') as AppLocale,
    myName: share.externalName ?? '',
    myEmailMasked: maskEmail(share.externalEmail ?? ''),
    myRole: share.role,
    myBps: share.shareBps,
    sheetSha256: version!.splitSheetSha256,
    expiresAt: share.signTokenExpiresAt,
    parties: parties
      .sort((a, b) => b.share.shareBps - a.share.shareBps)
      .map((p) => ({ displayName: p.displayName, role: p.share.role, bps: p.share.shareBps, status: p.share.status, isMe: p.share.id === share.id, isMember: !!p.share.writerUserId })),
  };
}

const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => `${a}${'•'.repeat(Math.min(b.length, 6))}${c}`);

/** B2: envía el código de verificación al correo invitado. */
export async function sendGuestCode(deps: Deps, token: string, locale: AppLocale) {
  const inv = await getGuestInvitation(deps, token);
  if (!inv || inv.state !== 'open') throw new DomainError('INVITATION_NOT_OPEN');
  const [share] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.id, inv.shareId));
  const code = await withSystem(deps.db, { actorId: null, actorRole: 'guest', command: 'split.guest_code' }, (tx) =>
    createChallenge(tx, deps.now(), share!.externalEmail!, 'split_share', share!.id),
  );
  const email = renderEmail('signature_code', locale, { code, workTitle: inv.workTitle });
  await deps.mail.send({ to: share!.externalEmail!, ...email, tag: 'signature_code', idempotencyKey: `sigcode:${share!.id}:${Date.now()}` });
  return { sentTo: inv.myEmailMasked };
}

/** B3: el coautor invitado firma con el código. Su parte queda registrada como informativa. */
export async function signAsGuest(deps: Deps, token: string, code: string, ctx: RequestCtx) {
  const share = await shareByToken(deps, token);
  if (!share) throw new DomainError('INVITATION_NOT_FOUND');
  await withSystem(deps.db, { actorId: null, actorRole: 'guest', command: 'split.sign_guest', ...ctx }, async (tx) => {
    const now = deps.now();
    const { version } = await signableShare(tx, share.id, now);
    const verifiedAt = await consumeChallenge(tx, now, 'split_share', share.id, code);
    const sigId = await signatureFor(tx, { sha: version.splitSheetSha256!, versionId: version.id, userId: null, name: share.externalName!, email: share.externalEmail!, method: 'link+otp', verifiedAt: verifiedAt.toISOString(), ctx });
    await tx.update(t.splitShares).set({ status: 'signed', signedAt: now.toISOString(), signatureId: sigId }).where(and(eq(t.splitShares.id, share.id), eq(t.splitShares.status, 'pending')));
    await afterSignature(deps, tx, version.id, share.externalName!);
  });
}

/** B3: reclamo del invitado (también exige el código, para que un enlace reenviado no pueda bloquear una obra). */
export async function rejectAsGuest(deps: Deps, token: string, code: string, reason: string, ctx: RequestCtx) {
  const share = await shareByToken(deps, token);
  if (!share) throw new DomainError('INVITATION_NOT_FOUND');
  await withSystem(deps.db, { actorId: null, actorRole: 'guest', command: 'split.reject_guest', ...ctx }, async (tx) => {
    await consumeChallenge(tx, deps.now(), 'split_share', share.id, code);
    await rejectShareTx(deps, tx, share.id, reason, { userId: null, email: share.externalEmail!, name: share.externalName! });
  });
}

export const shareLabel = (bps: number, locale: AppLocale) => formatBps(bps, intlLocale(locale));

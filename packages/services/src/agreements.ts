import { eq, t, withSystem } from '@pluma/db';
import { DomainError } from '@pluma/domain';
import { renderEmail } from '@pluma/emails';
import { consumeChallenge, createChallenge } from './challenges';
import type { Deps, RequestCtx } from './deps';
import { currentAdminAgreement } from './legal';
import { getSession } from './users';

async function contractContext(deps: Deps, userId: string) {
  const s = await getSession(deps, userId);
  if (!s?.profile) throw new DomainError('PROFILE_REQUIRED');
  if (s.agreementSigned) throw new DomainError('AGREEMENT_ALREADY_SIGNED');
  if (!s.membership) throw new DomainError('PLAN_REQUIRED');
  const doc = await currentAdminAgreement(deps, s.locale);
  return { s, doc };
}

/** Firma del contrato de administración por un autor mayor de edad, con su sesión verificada. */
export async function signAdminAgreement(deps: Deps, userId: string, ctx: RequestCtx) {
  const { s, doc } = await contractContext(deps, userId);
  if (s.minor) throw new DomainError('GUARDIAN_MUST_SIGN');
  const [user] = await deps.db.select().from(t.users).where(eq(t.users.id, userId));
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'agreement.sign', ...ctx }, async (tx) => {
    const [sig] = await tx
      .insert(t.signatures)
      .values({
        documentSha256: doc.sha256,
        documentKind: 'legal_document',
        documentRef: doc.id,
        signerUserId: userId,
        signerName: s.profile!.legalName,
        signerEmail: s.email,
        method: 'session',
        otpVerifiedAt: user?.emailVerifiedAt ?? deps.now().toISOString(),
        ip: ctx.ip ?? '0.0.0.0',
        userAgent: ctx.userAgent ?? 'unknown',
      })
      .returning({ id: t.signatures.id });
    await tx.insert(t.agreements).values({ userId, legalDocumentId: doc.id, signatureId: sig!.id });
  });
}

/** Autor menor: se envía un código al correo del tutor legal. */
export async function requestGuardianCode(deps: Deps, userId: string) {
  const { s } = await contractContext(deps, userId);
  if (!s.minor || !s.guardian) throw new DomainError('GUARDIAN_REQUIRED');
  const code = await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'agreement.guardian_code' }, (tx) =>
    createChallenge(tx, deps.now(), s.guardian!.email, 'guardian_agreement', userId),
  );
  const email = renderEmail('guardian_code', s.locale, { code, minorName: s.profile!.artistName || s.profile!.legalName });
  await deps.mail.send({ to: s.guardian.email, ...email, tag: 'guardian_code', idempotencyKey: `guardian:${userId}:${Date.now()}` });
}

/** El tutor firma en nombre del menor usando el código que recibió. */
export async function signAdminAgreementAsGuardian(deps: Deps, userId: string, code: string, ctx: RequestCtx) {
  const { s, doc } = await contractContext(deps, userId);
  if (!s.minor || !s.guardian) throw new DomainError('GUARDIAN_REQUIRED');
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'agreement.sign_guardian', ...ctx }, async (tx) => {
    const verifiedAt = await consumeChallenge(tx, deps.now(), 'guardian_agreement', userId, code);
    const [sig] = await tx
      .insert(t.signatures)
      .values({
        documentSha256: doc.sha256,
        documentKind: 'legal_document',
        documentRef: doc.id,
        signerName: s.guardian!.legalName,
        signerEmail: s.guardian!.email,
        onBehalfOfUserId: userId,
        method: 'guardian+otp',
        otpVerifiedAt: verifiedAt.toISOString(),
        ip: ctx.ip ?? '0.0.0.0',
        userAgent: ctx.userAgent ?? 'unknown',
      })
      .returning({ id: t.signatures.id });
    await tx.insert(t.agreements).values({ userId, legalDocumentId: doc.id, signatureId: sig!.id });
    await tx.update(t.guardians).set({ verifiedAt: verifiedAt.toISOString() }).where(eq(t.guardians.writerUserId, userId));
  });
}

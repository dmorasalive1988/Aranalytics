import { and, desc, eq, isNull, t, type Tx } from '@pluma/db';
import { DomainError } from '@pluma/domain';
import { sha256, sixDigitCode } from './crypto';

const TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

export type ChallengePurpose = 'split_share' | 'guardian_agreement';

/** Crea un código de un solo uso. Devuelve el código en claro para enviarlo por correo (nunca se guarda). */
export async function createChallenge(tx: Tx, now: Date, email: string, purpose: ChallengePurpose, refId: string) {
  const code = sixDigitCode();
  await tx.insert(t.signatureChallenges).values({
    email,
    purpose,
    refId,
    codeHash: sha256(`${purpose}:${refId}:${code}`),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
  });
  return code;
}

/** Verifica el último código emitido; cuenta intentos y lo consume. Devuelve la hora de verificación. */
export async function consumeChallenge(tx: Tx, now: Date, purpose: ChallengePurpose, refId: string, code: string): Promise<Date> {
  const [c] = await tx
    .select()
    .from(t.signatureChallenges)
    .where(and(eq(t.signatureChallenges.purpose, purpose), eq(t.signatureChallenges.refId, refId), isNull(t.signatureChallenges.consumedAt)))
    .orderBy(desc(t.signatureChallenges.createdAt))
    .limit(1);
  if (!c || new Date(c.expiresAt) < now) throw new DomainError('CODE_EXPIRED');
  if (c.attempts >= MAX_ATTEMPTS) throw new DomainError('CODE_TOO_MANY_ATTEMPTS');
  if (c.codeHash !== sha256(`${purpose}:${refId}:${code.trim()}`)) {
    await tx.update(t.signatureChallenges).set({ attempts: c.attempts + 1 }).where(eq(t.signatureChallenges.id, c.id));
    throw new DomainError('CODE_INVALID');
  }
  await tx.update(t.signatureChallenges).set({ consumedAt: now.toISOString() }).where(eq(t.signatureChallenges.id, c.id));
  return now;
}

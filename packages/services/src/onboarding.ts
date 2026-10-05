import { eq, t, withSystem } from '@pluma/db';
import { DomainError, isValidEmail, isValidIpi, normalizeIpi, PRO_SOCIETIES, ageOn } from '@pluma/domain';
import type { Deps, RequestCtx } from './deps';

export const PUBLISHER_ID = '00000000-0000-4000-8000-000000000001';

export interface ProfileInput {
  legalName: string;
  artistName: string | null;
  country: string;
  city: string | null;
  birthDate: string; // YYYY-MM-DD
}

export async function saveProfile(deps: Deps, userId: string, input: ProfileInput, ctx: RequestCtx) {
  const legalName = input.legalName.trim();
  if (legalName.length < 3) throw new DomainError('LEGAL_NAME_REQUIRED');
  if (!/^[A-Z]{2}$/.test(input.country)) throw new DomainError('COUNTRY_REQUIRED');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || Number.isNaN(Date.parse(input.birthDate))) throw new DomainError('BIRTH_DATE_INVALID');
  const age = ageOn(input.birthDate, deps.now());
  if (age < 13 || age > 120) throw new DomainError('BIRTH_DATE_INVALID');

  const values = {
    userId,
    publisherId: PUBLISHER_ID,
    legalName,
    artistName: input.artistName?.trim() || null,
    country: input.country,
    city: input.city?.trim() || null,
    birthDate: input.birthDate,
    // Datos de menores: fuera de la Red y de catálogos por defecto.
    networkVisible: age >= 18,
  };
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'onboarding.profile', ...ctx }, (tx) =>
    tx.insert(t.writerProfiles).values(values).onConflictDoUpdate({ target: t.writerProfiles.userId, set: values }),
  );
}

export interface SocietyInput {
  societyCode: string | null; // uno de PRO_SOCIETIES, o null con societyOther
  societyOther: string | null; // nombre de otra sociedad, o 'NONE' si todavía no está afiliado
  ipi: string | null;
}

export async function saveSociety(deps: Deps, userId: string, input: SocietyInput, ctx: RequestCtx) {
  const code = input.societyCode && PRO_SOCIETIES.some((s) => s.code === input.societyCode) ? input.societyCode : null;
  const other = code ? null : input.societyOther?.trim() || null;
  if (!code && !other) throw new DomainError('SOCIETY_REQUIRED');
  const ipiRaw = input.ipi?.trim() || null;
  if (ipiRaw && !isValidIpi(ipiRaw)) throw new DomainError('IPI_INVALID');
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'onboarding.society', ...ctx }, (tx) =>
    tx
      .update(t.writerProfiles)
      .set({ societyCode: code, societyOther: other, ipi: ipiRaw ? normalizeIpi(ipiRaw) : null })
      .where(eq(t.writerProfiles.userId, userId)),
  );
}

export interface GuardianInput {
  legalName: string;
  email: string;
  relationship: string;
}

/**
 * Tutor legal de un autor menor de edad. El documento de identidad del tutor se sube en el paso de
 * KYC (antes del primer pago); aquí se registran sus datos para que firme el contrato.
 */
export async function saveGuardian(deps: Deps, userId: string, input: GuardianInput, ctx: RequestCtx) {
  if (input.legalName.trim().length < 3) throw new DomainError('LEGAL_NAME_REQUIRED');
  if (!isValidEmail(input.email)) throw new DomainError('EMAIL_INVALID');
  if (!input.relationship.trim()) throw new DomainError('RELATIONSHIP_REQUIRED');
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'onboarding.guardian', ...ctx }, async (tx) => {
    await tx.delete(t.guardians).where(eq(t.guardians.writerUserId, userId));
    await tx.insert(t.guardians).values({
      writerUserId: userId,
      legalName: input.legalName.trim(),
      email: input.email.trim().toLowerCase(),
      relationship: input.relationship.trim(),
      idDocumentPath: 'pending-kyc',
    });
  });
}

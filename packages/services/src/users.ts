import { and, eq, t, withSystem, sql } from '@pluma/db';
import { effectiveStatus, isMinor, type MembershipStatus, type PlanCode } from '@pluma/domain';
import type { Deps } from './deps';
import type { AppLocale } from './format';

/** Crea (o actualiza) el usuario de la app al entrar por primera vez. Idempotente. */
export async function ensureAppUser(deps: Deps, auth: { id: string; email: string; emailVerified: boolean }, locale: AppLocale) {
  await withSystem(deps.db, { actorId: auth.id, actorRole: 'writer', command: 'user.ensure' }, async (tx) => {
    await tx
      .insert(t.users)
      .values({ id: auth.id, email: auth.email.toLowerCase(), locale, emailVerifiedAt: auth.emailVerified ? deps.now().toISOString() : null })
      .onConflictDoUpdate({
        target: t.users.id,
        set: { email: auth.email.toLowerCase(), emailVerifiedAt: sql`coalesce(${t.users.emailVerifiedAt}, excluded.email_verified_at)` },
      });
    await tx.insert(t.userRoles).values({ userId: auth.id, role: 'writer' }).onConflictDoNothing();
  });
}

export async function setLocale(deps: Deps, userId: string, locale: AppLocale) {
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'user.set_locale' }, (tx) =>
    tx.update(t.users).set({ locale }).where(eq(t.users.id, userId)),
  );
}

export type OnboardingStep = 'profile' | 'society' | 'guardian' | 'plan' | 'contract' | 'payment' | 'done';

export interface SessionInfo {
  userId: string;
  email: string;
  locale: AppLocale;
  roles: string[];
  profile: typeof t.writerProfiles.$inferSelect | null;
  minor: boolean;
  guardian: typeof t.guardians.$inferSelect | null;
  membership: { plan: PlanCode; status: MembershipStatus; effectiveStatus: MembershipStatus; currentPeriodStart: string | null; currentPeriodEnd: string | null; scheduledPlan: PlanCode | null } | null;
  agreementSigned: boolean;
  step: OnboardingStep;
}

/** Todo lo que la app necesita saber del usuario para decidir a qué pantalla va. */
export async function getSession(deps: Deps, userId: string): Promise<SessionInfo | null> {
  const db = deps.db;
  const [user] = await db.select().from(t.users).where(eq(t.users.id, userId));
  if (!user) return null;
  const [roles, [profile], [membership], [guardian], [agreement]] = await Promise.all([
    db.select({ role: t.userRoles.role }).from(t.userRoles).where(eq(t.userRoles.userId, userId)),
    db.select().from(t.writerProfiles).where(eq(t.writerProfiles.userId, userId)),
    db.select().from(t.memberships).where(eq(t.memberships.userId, userId)),
    db.select().from(t.guardians).where(eq(t.guardians.writerUserId, userId)),
    db
      .select({ id: t.agreements.id })
      .from(t.agreements)
      .innerJoin(t.legalDocuments, eq(t.legalDocuments.id, t.agreements.legalDocumentId))
      .where(and(eq(t.agreements.userId, userId), eq(t.legalDocuments.kind, 'admin_agreement'))),
  ]);

  const now = deps.now();
  const minor = profile ? isMinor(profile.birthDate, profile.country, now) : false;
  const m = membership
    ? {
        plan: membership.planCode,
        status: membership.status,
        effectiveStatus: effectiveStatus({ plan: membership.planCode, status: membership.status, currentPeriodEnd: membership.currentPeriodEnd ? new Date(membership.currentPeriodEnd) : null }, now),
        currentPeriodStart: membership.currentPeriodStart,
        currentPeriodEnd: membership.currentPeriodEnd,
        scheduledPlan: membership.scheduledPlanCode,
      }
    : null;

  let step: OnboardingStep = 'done';
  if (!profile) step = 'profile';
  else if (!profile.societyCode && !profile.societyOther) step = 'society';
  else if (minor && !guardian) step = 'guardian';
  else if (!m) step = 'plan';
  else if (!agreement) step = 'contract';
  else if (m.status === 'pending_payment') step = 'payment';

  return {
    userId,
    email: user.email,
    locale: user.locale,
    roles: roles.map((r) => r.role),
    profile: profile ?? null,
    minor,
    guardian: guardian ?? null,
    membership: m,
    agreementSigned: !!agreement,
    step,
  };
}

import { DomainError } from './errors';

export type PlanCode = 'socio' | 'pro';
export type MembershipStatus = 'pending_payment' | 'active' | 'past_due' | 'suspended' | 'canceled';

export interface PlanFeatures {
  network: boolean;
  sync: boolean;
  ar: boolean;
  analytics: boolean;
  featuredProfile: boolean;
  campsPriority: boolean;
  dailyApplications: number;
}

export interface PlanConfig {
  code: PlanCode;
  priceCents: number;
  currency: 'USD';
  commissionBps: number;
  features: PlanFeatures;
}

/** Valores de arranque; en producción se leen de la tabla `plans` (editable por super admin). */
export const DEFAULT_PLANS: Record<PlanCode, PlanConfig> = {
  socio: {
    code: 'socio',
    priceCents: 2000,
    currency: 'USD',
    commissionBps: 2000,
    features: { network: true, sync: false, ar: false, analytics: false, featuredProfile: false, campsPriority: false, dailyApplications: 3 },
  },
  pro: {
    code: 'pro',
    priceCents: 5000,
    currency: 'USD',
    commissionBps: 1500,
    features: { network: true, sync: true, ar: true, analytics: true, featuredProfile: true, campsPriority: true, dailyApplications: 10 },
  },
};

export const GRACE_DAYS = 15;
export const RENEWAL_NOTICE_DAYS = 15;
const DAY = 86_400_000;

export interface MembershipSnapshot {
  plan: PlanCode;
  status: MembershipStatus;
  currentPeriodEnd: Date | null;
}

/**
 * Estado efectivo en una fecha: una membresía "active" cuyo período terminó entra en gracia
 * (past_due) por 15 días y luego queda suspendida. Se usa tanto en la app como en el cron.
 */
export function effectiveStatus(m: MembershipSnapshot, now: Date): MembershipStatus {
  if (m.status === 'canceled' || m.status === 'pending_payment' || m.status === 'suspended') return m.status;
  if (!m.currentPeriodEnd) return m.status;
  const end = m.currentPeriodEnd.getTime();
  if (now.getTime() <= end && m.status === 'active') return 'active';
  return now.getTime() <= end + GRACE_DAYS * DAY ? 'past_due' : 'suspended';
}

export const graceEndsAt = (periodEnd: Date) => new Date(periodEnd.getTime() + GRACE_DAYS * DAY);

export type GatedFeature = 'network' | 'sync' | 'ar' | 'analytics';

/**
 * ¿Puede usar la función? La red y los opt-ins se apagan con la suspensión; la administración
 * de obras ya registradas y el pago de regalías nunca dependen de esto.
 */
export function canUseFeature(
  m: MembershipSnapshot | null,
  feature: GatedFeature,
  now: Date,
  plans: Record<PlanCode, PlanConfig> = DEFAULT_PLANS,
): boolean {
  if (!m) return false;
  const status = effectiveStatus(m, now);
  if (status !== 'active' && status !== 'past_due') return false;
  return plans[m.plan].features[feature];
}

export function assertFeature(m: MembershipSnapshot | null, feature: GatedFeature, now: Date, plans?: Record<PlanCode, PlanConfig>) {
  if (!canUseFeature(m, feature, now, plans)) {
    throw new DomainError(feature === 'sync' || feature === 'ar' || feature === 'analytics' ? 'PLAN_REQUIRES_PRO' : 'MEMBERSHIP_INACTIVE', { feature });
  }
}

/** Mejora a Pro: se cobra la diferencia prorrateada por el tiempo que queda del período pagado. */
export function upgradeProrationCents(args: {
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  fromPriceCents: number;
  toPriceCents: number;
}): number {
  const total = args.periodEnd.getTime() - args.periodStart.getTime();
  const remaining = Math.min(Math.max(args.periodEnd.getTime() - args.now.getTime(), 0), total);
  if (total <= 0 || args.toPriceCents <= args.fromPriceCents) return 0;
  return Math.round(((args.toPriceCents - args.fromPriceCents) * remaining) / total);
}

export interface PlanPeriod {
  plan: PlanCode;
  commissionBps: number;
  validFrom: Date;
  validTo: Date | null;
}

/**
 * Comisión aplicable en una fecha (la de publicación del statement). Si en esa fecha no hay plan
 * vigente (membresía vencida), se usa el último plan que tuvo; si nunca tuvo uno, la de Socio.
 */
export function commissionAt(periods: PlanPeriod[], at: Date, plans: Record<PlanCode, PlanConfig> = DEFAULT_PLANS): { plan: PlanCode; commissionBps: number } {
  const t = at.getTime();
  const current = periods.find((p) => p.validFrom.getTime() <= t && (p.validTo === null || t < p.validTo.getTime()));
  if (current) return { plan: current.plan, commissionBps: current.commissionBps };
  const past = periods
    .filter((p) => p.validFrom.getTime() <= t)
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];
  if (past) return { plan: past.plan, commissionBps: past.commissionBps };
  return { plan: 'socio', commissionBps: plans.socio.commissionBps };
}

/** ¿Toca el aviso de renovación (15 días antes)? */
export function isRenewalNoticeDue(periodEnd: Date, now: Date): boolean {
  const diff = periodEnd.getTime() - now.getTime();
  return diff > 0 && diff <= RENEWAL_NOTICE_DAYS * DAY;
}

/** Fin de un período anual a partir de su inicio. */
export function addOneYear(d: Date): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + 1);
  return r;
}

/** Calculadora del sitio: neto = recaudo × (1 − comisión) − membresía (en centavos; puede ser negativo). */
export function annualNetCents(grossCents: number, plan: Pick<PlanConfig, 'priceCents' | 'commissionBps'>) {
  return grossCents - Math.round((grossCents * plan.commissionBps) / 10_000) - plan.priceCents;
}

/** Recaudo anual desde el cual el plan con menor comisión deja igual o más neto que el otro. */
export function breakEvenCents(cheap: Pick<PlanConfig, 'priceCents' | 'commissionBps'>, premium: Pick<PlanConfig, 'priceCents' | 'commissionBps'>) {
  const bpsDiff = cheap.commissionBps - premium.commissionBps;
  if (bpsDiff <= 0) return null;
  return Math.ceil(((premium.priceCents - cheap.priceCents) * 10_000) / bpsDiff);
}

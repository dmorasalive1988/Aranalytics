import { canUseFeature, type MembershipStatus } from '@pluma/domain';

/** La analítica es del plan Pro: decide si se muestra la pestaña y si la página abre. */
export function hasAnalytics(ms: { plan: 'socio' | 'pro'; status: string; currentPeriodEnd: string | Date | null }) {
  return canUseFeature({ plan: ms.plan, status: ms.status as MembershipStatus, currentPeriodEnd: ms.currentPeriodEnd ? new Date(ms.currentPeriodEnd) : null }, 'analytics', new Date());
}

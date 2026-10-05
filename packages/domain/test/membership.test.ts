import { describe, expect, it } from 'vitest';
import { canUseFeature, commissionAt, effectiveStatus, upgradeProrationCents, isRenewalNoticeDue, assertFeature, type MembershipSnapshot } from '../src';

const d = (s: string) => new Date(s + 'T00:00:00Z');

describe('membresía', () => {
  const socio: MembershipSnapshot = { plan: 'socio', status: 'active', currentPeriodEnd: d('2027-01-01') };
  const pro: MembershipSnapshot = { ...socio, plan: 'pro' };

  it('Socio no puede activar sync ni A&R; Pro sí (criterio 1)', () => {
    const now = d('2026-10-05');
    expect(canUseFeature(socio, 'sync', now)).toBe(false);
    expect(canUseFeature(socio, 'ar', now)).toBe(false);
    expect(canUseFeature(socio, 'network', now)).toBe(true);
    expect(canUseFeature(pro, 'sync', now)).toBe(true);
    expect(() => assertFeature(socio, 'sync', now)).toThrowError('PLAN_REQUIRES_PRO');
  });

  it('15 días de gracia y luego suspensión de red y opt-ins', () => {
    expect(effectiveStatus(pro, d('2027-01-10'))).toBe('past_due');
    expect(canUseFeature(pro, 'sync', d('2027-01-10'))).toBe(true);
    expect(effectiveStatus(pro, d('2027-01-17'))).toBe('suspended');
    expect(canUseFeature(pro, 'sync', d('2027-01-17'))).toBe(false);
    expect(canUseFeature(pro, 'network', d('2027-01-17'))).toBe(false);
  });

  it('sin plan activo no hay red', () => {
    expect(canUseFeature(null, 'network', d('2026-10-05'))).toBe(false);
    expect(canUseFeature({ ...socio, status: 'pending_payment' }, 'network', d('2026-10-05'))).toBe(false);
  });

  it('mejora a Pro: cobra la diferencia prorrateada', () => {
    const args = { periodStart: d('2026-01-01'), periodEnd: d('2027-01-01'), fromPriceCents: 2000, toPriceCents: 5000 };
    expect(upgradeProrationCents({ ...args, now: d('2026-01-01') })).toBe(3000);
    expect(upgradeProrationCents({ ...args, now: d('2026-07-02') })).toBe(1504); // 183 de 365 días × USD 30
    expect(upgradeProrationCents({ ...args, now: d('2027-02-01') })).toBe(0);
    expect(upgradeProrationCents({ ...args, fromPriceCents: 5000, toPriceCents: 2000, now: d('2026-03-01') })).toBe(0);
  });

  it('la comisión es la del plan vigente en la fecha de publicación', () => {
    const periods = [
      { plan: 'socio' as const, commissionBps: 2000, validFrom: d('2026-01-01'), validTo: d('2026-06-01') },
      { plan: 'pro' as const, commissionBps: 1500, validFrom: d('2026-06-01'), validTo: d('2027-06-01') },
    ];
    expect(commissionAt(periods, d('2026-05-31')).commissionBps).toBe(2000);
    expect(commissionAt(periods, d('2026-06-01')).commissionBps).toBe(1500);
    // vencida: último plan que tuvo
    expect(commissionAt(periods, d('2028-01-01'))).toEqual({ plan: 'pro', commissionBps: 1500 });
    // nunca tuvo plan
    expect(commissionAt([], d('2026-01-01')).commissionBps).toBe(2000);
  });

  it('aviso de renovación 15 días antes', () => {
    expect(isRenewalNoticeDue(d('2027-01-01'), d('2026-12-17'))).toBe(true);
    expect(isRenewalNoticeDue(d('2027-01-01'), d('2026-12-15'))).toBe(false);
    expect(isRenewalNoticeDue(d('2027-01-01'), d('2027-01-02'))).toBe(false);
  });
});

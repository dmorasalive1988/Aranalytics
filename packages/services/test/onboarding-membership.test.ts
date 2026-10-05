import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { eq, t } from '@pluma/db';
import { makeHarness } from './harness';

const h = makeHarness();
const { S, deps, ctx } = h;
afterAll(() => h.close());

describe('onboarding y membresía (criterio 1)', () => {
  it('recorre los pasos en orden hasta "done"', async () => {
    const id = randomUUID();
    await S.ensureAppUser(deps, { id, email: `${id}@x.test`, emailVerified: true }, 'pt-BR');
    expect((await S.getSession(deps, id))!.step).toBe('profile');
    await S.saveProfile(deps, id, { legalName: 'Joana Silva', artistName: 'Jô', country: 'BR', city: 'Recife', birthDate: '1990-05-01' }, ctx);
    expect((await S.getSession(deps, id))!.step).toBe('society');
    await S.saveSociety(deps, id, { societyCode: 'UBC', societyOther: null, ipi: '00052210040' }, ctx);
    expect((await S.getSession(deps, id))!.step).toBe('plan');
    await S.choosePlan(deps, id, 'pro', ctx);
    expect((await S.getSession(deps, id))!.step).toBe('contract');
    await expect(S.startCheckout(deps, id, { successUrl: 'x', cancelUrl: 'y' })).rejects.toThrow('AGREEMENT_REQUIRED');
    await S.signAdminAgreement(deps, id, ctx);
    expect((await S.getSession(deps, id))!.step).toBe('payment');
    const { url } = await S.startCheckout(deps, id, { successUrl: 'http://app.test/listo', cancelUrl: 'http://app.test/plan' });
    const token = new URL(url).searchParams.get('token')!;
    const parsed = h.payments.readCheckoutToken(token)!;
    expect(parsed).toEqual({ userId: id, plan: 'pro' });
    for (const ev of h.payments.completeCheckout(id, 'pro', 5000, h.clock.now)) await S.applyPaymentEvent(deps, ev);
    // idempotente: el mismo webhook dos veces no duplica pagos
    for (const ev of h.payments.completeCheckout(id, 'pro', 5000, h.clock.now)) await S.applyPaymentEvent(deps, ev);
    const s = (await S.getSession(deps, id))!;
    expect(s.step).toBe('done');
    expect(s.membership).toMatchObject({ plan: 'pro', status: 'active' });
    expect(await deps.db.select().from(t.membershipPayments).where(eq(t.membershipPayments.userId, id))).toHaveLength(1);
    // el contrato quedó firmado con evidencia
    const [sig] = await deps.db.select().from(t.signatures).where(eq(t.signatures.signerUserId, id));
    expect(sig).toMatchObject({ method: 'session', ip: '198.51.100.10', userAgent: 'vitest' });
    expect(sig!.documentSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('un menor necesita a su tutor: el tutor firma con un código enviado a su correo', async () => {
    const id = randomUUID();
    await S.ensureAppUser(deps, { id, email: `${id}@x.test`, emailVerified: true }, 'es');
    await S.saveProfile(deps, id, { legalName: 'Mateo Pérez', artistName: null, country: 'MX', city: null, birthDate: '2010-01-01' }, ctx);
    await S.saveSociety(deps, id, { societyCode: null, societyOther: 'NONE', ipi: null }, ctx);
    expect((await S.getSession(deps, id))!.step).toBe('guardian');
    await S.saveGuardian(deps, id, { legalName: 'Laura Pérez', email: 'laura@tutor.test', relationship: 'madre' }, ctx);
    await S.choosePlan(deps, id, 'socio', ctx);
    await expect(S.signAdminAgreement(deps, id, ctx)).rejects.toThrow('GUARDIAN_MUST_SIGN');
    await S.requestGuardianCode(deps, id);
    await expect(S.signAdminAgreementAsGuardian(deps, id, '000000', ctx)).rejects.toThrow(/CODE_INVALID|CODE_EXPIRED/);
    await S.signAdminAgreementAsGuardian(deps, id, h.lastCodeFor('laura@tutor.test'), ctx);
    const [sig] = await deps.db.select().from(t.signatures).where(eq(t.signatures.onBehalfOfUserId, id));
    expect(sig).toMatchObject({ signerName: 'Laura Pérez', method: 'guardian+otp' });
    const [profile] = await deps.db.select().from(t.writerProfiles).where(eq(t.writerProfiles.userId, id));
    expect(profile!.networkVisible).toBe(false);
  });

  it('Socio no puede activar sync ni A&R; tras mejorar a Pro (con cobro prorrateado) sí', async () => {
    const w = await h.onboardWriter({ plan: 'socio' });
    const workId = await S.createWork(deps, w.id, { title: 'Sin grabar', altTitles: [], language: 'es', genre: 'bolero', lyrics: null, aiDeclaration: 'none', isrcs: [] }, ctx);
    await expect(S.setCatalogOptIns(deps, w.id, workId, { sync: true }, ctx)).rejects.toThrow('PLAN_REQUIRES_PRO');
    await expect(S.setCatalogOptIns(deps, w.id, workId, { ar: true }, ctx)).rejects.toThrow('PLAN_REQUIRES_PRO');

    h.clock.now = new Date('2027-04-05T15:00:00Z'); // a mitad del período
    const { chargedCents } = await S.upgradeToPro(deps, w.id, ctx);
    expect(chargedCents).toBe(1504);
    await S.setCatalogOptIns(deps, w.id, workId, { sync: true, ar: true }, ctx);
    const [work] = await deps.db.select().from(t.works).where(eq(t.works.id, workId));
    expect(work).toMatchObject({ syncOptIn: true, arOptIn: true });

    const periods = await deps.db.select().from(t.membershipPlanPeriods).where(eq(t.membershipPlanPeriods.userId, w.id)).orderBy(t.membershipPlanPeriods.validFrom);
    expect(periods.map((p) => [p.planCode, p.commissionBps])).toEqual([['socio', 2000], ['pro', 1500]]);
    expect(periods[0]!.validTo).not.toBeNull();
    const payments = await deps.db.select().from(t.membershipPayments).where(eq(t.membershipPayments.userId, w.id));
    expect(payments.map((p) => [p.kind, p.amountCents]).sort()).toEqual([['new', 2000], ['upgrade_proration', 1504]]);
    h.clock.now = new Date('2026-10-05T15:00:00Z');
  });

  it('gracia de 15 días y luego suspensión de opt-ins, sin tocar la administración', async () => {
    const w = await h.onboardWriter({ plan: 'pro' });
    const workId = await S.createWork(deps, w.id, { title: 'Para sync', altTitles: [], language: 'es', genre: 'pop', lyrics: null, aiDeclaration: 'none', isrcs: [] }, ctx);
    await S.setCatalogOptIns(deps, w.id, workId, { sync: true }, ctx);
    h.clock.now = new Date('2027-10-25T15:00:00Z'); // 20 días después del vencimiento
    const r = await S.runMembershipJobs(deps);
    expect(r.suspended).toBeGreaterThanOrEqual(1);
    const s = (await S.getSession(deps, w.id))!;
    expect(s.membership!.status).toBe('suspended');
    const [work] = await deps.db.select().from(t.works).where(eq(t.works.id, workId));
    expect(work).toMatchObject({ syncOptIn: true, optInsSuspended: true });
    h.clock.now = new Date('2026-10-05T15:00:00Z');
  });
});

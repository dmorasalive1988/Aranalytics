import type { PaymentEvent } from '@pluma/adapters';
import { and, desc, eq, inArray, isNull, lt, t, withSystem, sql, type Tx } from '@pluma/db';
import { DomainError, GRACE_DAYS, upgradeProrationCents, type PlanCode } from '@pluma/domain';
import type { Deps, RequestCtx } from './deps';
import { emit } from './events';
import { getSession } from './users';

const DAY = 86_400_000;

export async function loadPlans(deps: Deps) {
  const rows = await deps.db
    .select({ code: t.plans.code, commissionBps: t.plans.commissionBps, features: t.plans.features, amountCents: t.planPrices.amountCents, currency: t.planPrices.currency, priceId: t.planPrices.stripePriceId })
    .from(t.plans)
    .innerJoin(t.planPrices, and(eq(t.planPrices.planCode, t.plans.code), eq(t.planPrices.region, 'GLOBAL'), isNull(t.planPrices.validTo)))
    .where(eq(t.plans.active, true));
  return Object.fromEntries(rows.map((r) => [r.code, r])) as Record<PlanCode, (typeof rows)[number]>;
}

/** Paso "Elige tu plan" del onboarding: deja la membresía pendiente de pago con el plan elegido. */
export async function choosePlan(deps: Deps, userId: string, plan: PlanCode, ctx: RequestCtx) {
  const [m] = await deps.db.select().from(t.memberships).where(eq(t.memberships.userId, userId));
  if (m && m.status !== 'pending_payment') throw new DomainError('MEMBERSHIP_EXISTS');
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'membership.choose_plan', ...ctx }, (tx) =>
    tx
      .insert(t.memberships)
      .values({ userId, planCode: plan, status: 'pending_payment' })
      .onConflictDoUpdate({ target: t.memberships.userId, set: { planCode: plan } }),
  );
}

/** Abre el pago anual por adelantado. Solo después de firmar el contrato. */
export async function startCheckout(deps: Deps, userId: string, urls: { successUrl: string; cancelUrl: string }) {
  const s = await getSession(deps, userId);
  if (!s?.membership || s.membership.status !== 'pending_payment') throw new DomainError('NOTHING_TO_PAY');
  if (!s.agreementSigned) throw new DomainError('AGREEMENT_REQUIRED');
  const plans = await loadPlans(deps);
  return deps.payments.createCheckout({
    userId,
    email: s.email,
    plan: s.membership.plan,
    priceId: plans[s.membership.plan].priceId,
    locale: s.locale,
    ...urls,
  });
}

async function openPlanPeriod(tx: Tx, userId: string, plan: PlanCode, commissionBps: number, from: Date) {
  await tx
    .update(t.membershipPlanPeriods)
    .set({ validTo: from.toISOString() })
    .where(and(eq(t.membershipPlanPeriods.userId, userId), isNull(t.membershipPlanPeriods.validTo)));
  await tx.insert(t.membershipPlanPeriods).values({ userId, planCode: plan, commissionBps, validFrom: from.toISOString() });
}

/**
 * Aplica un evento de pago (webhook de Stripe o pago simulado). Idempotente: los webhooks se
 * repiten y llegan desordenados.
 */
export async function applyPaymentEvent(deps: Deps, ev: PaymentEvent) {
  const plans = await loadPlans(deps);
  await withSystem(deps.db, { actorId: null, actorRole: 'system', command: `payment.${ev.type}` }, async (tx) => {
    const bySub = async (subscriptionId: string) => (await tx.select().from(t.memberships).where(eq(t.memberships.stripeSubscriptionId, subscriptionId)))[0];

    switch (ev.type) {
      case 'subscription_activated': {
        const [m] = await tx.select().from(t.memberships).where(eq(t.memberships.userId, ev.userId));
        if (m?.status === 'active' && m.stripeSubscriptionId === ev.subscriptionId) return;
        await tx
          .insert(t.memberships)
          .values({ userId: ev.userId, planCode: ev.plan, status: 'active', currentPeriodStart: ev.periodStart.toISOString(), currentPeriodEnd: ev.periodEnd.toISOString(), stripeCustomerId: ev.customerId, stripeSubscriptionId: ev.subscriptionId })
          .onConflictDoUpdate({
            target: t.memberships.userId,
            set: { planCode: ev.plan, status: 'active', currentPeriodStart: ev.periodStart.toISOString(), currentPeriodEnd: ev.periodEnd.toISOString(), stripeCustomerId: ev.customerId, stripeSubscriptionId: ev.subscriptionId, graceEndsAt: null },
          });
        await openPlanPeriod(tx, ev.userId, ev.plan, plans[ev.plan].commissionBps, ev.periodStart);
        await tx.update(t.users).set({ onboardingCompletedAt: sql`coalesce(${t.users.onboardingCompletedAt}, now())` }).where(eq(t.users.id, ev.userId));
        return;
      }
      case 'invoice_paid': {
        const m = await bySub(ev.subscriptionId);
        if (!m) throw new Error(`membresía no encontrada para ${ev.subscriptionId}`);
        const inserted = await tx
          .insert(t.membershipPayments)
          .values({ userId: m.userId, kind: ev.kind, amountCents: ev.amountCents, currency: ev.currency, stripeInvoiceId: ev.invoiceId, status: 'paid', occurredAt: deps.now().toISOString() })
          .onConflictDoUpdate({ target: t.membershipPayments.stripeInvoiceId, set: { status: 'paid' }, where: sql`${t.membershipPayments.status} <> 'paid'` })
          .returning({ id: t.membershipPayments.id });
        if (inserted.length === 0) return; // ya aplicado
        if (ev.kind === 'renewal' && ev.periodEnd) {
          const plan = m.scheduledPlanCode ?? m.planCode;
          await tx
            .update(t.memberships)
            .set({ status: 'active', planCode: plan, scheduledPlanCode: null, graceEndsAt: null, currentPeriodStart: ev.periodStart?.toISOString(), currentPeriodEnd: ev.periodEnd.toISOString() })
            .where(eq(t.memberships.userId, m.userId));
          if (plan !== m.planCode) await openPlanPeriod(tx, m.userId, plan, plans[plan].commissionBps, ev.periodStart ?? deps.now());
          // Reactivación tras suspensión: se restauran los opt-ins recordados.
          await tx.update(t.works).set({ optInsSuspended: false }).where(eq(t.works.createdBy, m.userId));
        }
        if (ev.kind === 'new') await emit(tx, 'membership.activated', 'membership', m.userId, { amountCents: ev.amountCents, currency: ev.currency });
        return;
      }
      case 'invoice_failed': {
        const m = await bySub(ev.subscriptionId);
        if (!m) return;
        await tx
          .insert(t.membershipPayments)
          .values({ userId: m.userId, kind: 'renewal', amountCents: ev.amountCents, currency: ev.currency, stripeInvoiceId: ev.invoiceId, status: 'failed', occurredAt: deps.now().toISOString() })
          .onConflictDoNothing();
        const base = m.currentPeriodEnd ? new Date(m.currentPeriodEnd) : deps.now();
        const graceEndsAt = new Date(base.getTime() + GRACE_DAYS * DAY).toISOString();
        if (m.status !== 'past_due') {
          await tx.update(t.memberships).set({ status: 'past_due', graceEndsAt }).where(eq(t.memberships.userId, m.userId));
          await emit(tx, 'membership.payment_failed', 'membership', m.userId, { graceEndsAt });
        }
        return;
      }
      case 'subscription_plan_changed': {
        const m = await bySub(ev.subscriptionId);
        if (!m || m.planCode === ev.plan) return;
        await tx.update(t.memberships).set({ planCode: ev.plan, scheduledPlanCode: null, currentPeriodStart: ev.periodStart.toISOString(), currentPeriodEnd: ev.periodEnd.toISOString() }).where(eq(t.memberships.userId, m.userId));
        await openPlanPeriod(tx, m.userId, ev.plan, plans[ev.plan].commissionBps, deps.now());
        return;
      }
      case 'subscription_canceled': {
        const m = await bySub(ev.subscriptionId);
        if (m) await tx.update(t.memberships).set({ status: 'canceled' }).where(eq(t.memberships.userId, m.userId));
        return;
      }
    }
  });
}

/** Mejora a Pro: inmediata, cobrando la diferencia prorrateada. */
export async function upgradeToPro(deps: Deps, userId: string, ctx: RequestCtx) {
  const [m] = await deps.db.select().from(t.memberships).where(eq(t.memberships.userId, userId));
  if (!m || !['active', 'past_due'].includes(m.status) || !m.stripeSubscriptionId || !m.currentPeriodStart || !m.currentPeriodEnd) throw new DomainError('MEMBERSHIP_INACTIVE');
  if (m.planCode === 'pro') {
    if (m.scheduledPlanCode) {
      await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'membership.cancel_downgrade', ...ctx }, (tx) =>
        tx.update(t.memberships).set({ scheduledPlanCode: null }).where(eq(t.memberships.userId, userId)),
      );
      return { chargedCents: 0 };
    }
    throw new DomainError('ALREADY_PRO');
  }
  const plans = await loadPlans(deps);
  const now = deps.now();
  const prorationCents = upgradeProrationCents({
    periodStart: new Date(m.currentPeriodStart),
    periodEnd: new Date(m.currentPeriodEnd),
    now,
    fromPriceCents: plans.socio.amountCents,
    toPriceCents: plans.pro.amountCents,
  });
  const events = await deps.payments.upgrade({ subscriptionId: m.stripeSubscriptionId, toPriceId: plans.pro.priceId, prorationCents });
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'membership.upgrade', ...ctx }, async (tx) => {
    await tx.update(t.memberships).set({ planCode: 'pro', scheduledPlanCode: null }).where(eq(t.memberships.userId, userId));
    await openPlanPeriod(tx, userId, 'pro', plans.pro.commissionBps, now);
  });
  for (const e of events) await applyPaymentEvent(deps, e);
  return { chargedCents: prorationCents };
}

/** Bajada a Socio: al final del período pagado. */
export async function scheduleDowngrade(deps: Deps, userId: string, ctx: RequestCtx) {
  const [m] = await deps.db.select().from(t.memberships).where(eq(t.memberships.userId, userId));
  if (!m || m.planCode !== 'pro' || !m.stripeSubscriptionId) throw new DomainError('NOT_PRO');
  const plans = await loadPlans(deps);
  await deps.payments.scheduleDowngrade({ subscriptionId: m.stripeSubscriptionId, toPriceId: plans.socio.priceId });
  await withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'membership.schedule_downgrade', ...ctx }, (tx) =>
    tx.update(t.memberships).set({ scheduledPlanCode: 'socio' }).where(eq(t.memberships.userId, userId)),
  );
}

/** Tarea diaria: avisos de renovación (−15 días) y suspensión al terminar la gracia. */
export async function runMembershipJobs(deps: Deps) {
  const now = deps.now();
  const in15 = new Date(now.getTime() + 15 * DAY).toISOString();
  const due = await deps.db
    .select()
    .from(t.memberships)
    .where(and(eq(t.memberships.status, 'active'), lt(t.memberships.currentPeriodEnd, in15), sql`${t.memberships.currentPeriodEnd} > ${now.toISOString()}`));
  let notified = 0;
  for (const m of due) {
    await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'membership.renewal_notice' }, (tx) =>
      emit(tx, 'membership.renewal_upcoming', 'membership', m.userId, { periodEnd: m.currentPeriodEnd, plan: m.planCode }),
    );
    notified++;
  }

  const graceLimit = new Date(now.getTime() - GRACE_DAYS * DAY).toISOString();
  const expired = await deps.db
    .select()
    .from(t.memberships)
    .where(and(inArray(t.memberships.status, ['active', 'past_due']), lt(t.memberships.currentPeriodEnd, graceLimit)));
  for (const m of expired) {
    await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'membership.suspend' }, async (tx) => {
      await tx.update(t.memberships).set({ status: 'suspended' }).where(eq(t.memberships.userId, m.userId));
      // Los opt-ins se recuerdan pero dejan de exponerse; administración y regalías siguen.
      await tx.update(t.works).set({ optInsSuspended: true }).where(eq(t.works.createdBy, m.userId));
      await emit(tx, 'membership.suspended', 'membership', m.userId);
    });
  }
  return { notified, suspended: expired.length };
}

export async function membershipPayments(deps: Deps, userId: string) {
  return deps.db.select().from(t.membershipPayments).where(eq(t.membershipPayments.userId, userId)).orderBy(desc(t.membershipPayments.occurredAt));
}

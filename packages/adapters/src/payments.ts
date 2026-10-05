import { createHmac, timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';

export type PlanCode = 'socio' | 'pro';

/** Evento de pago normalizado: la lógica de membresía no conoce al proveedor. */
export type PaymentEvent =
  | {
      type: 'subscription_activated';
      userId: string;
      plan: PlanCode;
      customerId: string;
      subscriptionId: string;
      periodStart: Date;
      periodEnd: Date;
    }
  | {
      type: 'invoice_paid';
      subscriptionId: string;
      invoiceId: string;
      amountCents: number;
      currency: string;
      kind: 'new' | 'renewal' | 'upgrade_proration';
      periodStart: Date | null;
      periodEnd: Date | null;
    }
  | { type: 'invoice_failed'; subscriptionId: string; invoiceId: string; amountCents: number; currency: string }
  | { type: 'subscription_plan_changed'; subscriptionId: string; plan: PlanCode; periodStart: Date; periodEnd: Date }
  | { type: 'subscription_canceled'; subscriptionId: string };

export interface CheckoutInput {
  userId: string;
  email: string;
  plan: PlanCode;
  priceId: string;
  locale: 'es' | 'en' | 'pt-BR';
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  readonly kind: 'stripe' | 'fake';
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /** Mejora inmediata con cobro prorrateado. Devuelve los eventos a aplicar ya (el webhook los repetirá: idempotente). */
  upgrade(input: { subscriptionId: string; toPriceId: string; prorationCents: number }): Promise<PaymentEvent[]>;
  /** Bajada al final del período pagado. */
  scheduleDowngrade(input: { subscriptionId: string; toPriceId: string }): Promise<void>;
  parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent | null>;
}

const toDate = (s: number) => new Date(s * 1000);

export class StripePayments implements PaymentProvider {
  readonly kind = 'stripe' as const;
  private readonly stripe: Stripe;
  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
    private readonly priceToPlan: Record<string, PlanCode>,
  ) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckout(i: CheckoutInput) {
    const s = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: i.priceId, quantity: 1 }],
      customer_email: i.email,
      client_reference_id: i.userId,
      metadata: { userId: i.userId, plan: i.plan },
      subscription_data: { metadata: { userId: i.userId, plan: i.plan } },
      locale: i.locale === 'pt-BR' ? 'pt-BR' : i.locale,
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
    });
    if (!s.url) throw new Error('Stripe no devolvió URL de checkout');
    return { url: s.url };
  }

  async upgrade(i: { subscriptionId: string; toPriceId: string }) {
    const sub = await this.stripe.subscriptions.retrieve(i.subscriptionId);
    const item = sub.items.data[0];
    if (!item) throw new Error('suscripción sin ítems');
    const updated = await this.stripe.subscriptions.update(i.subscriptionId, {
      items: [{ id: item.id, price: i.toPriceId }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'error_if_incomplete',
      expand: ['latest_invoice'],
    });
    const inv = updated.latest_invoice as Stripe.Invoice | null;
    const it = updated.items.data[0]!;
    const events: PaymentEvent[] = [
      { type: 'subscription_plan_changed', subscriptionId: updated.id, plan: this.priceToPlan[i.toPriceId] ?? 'pro', periodStart: toDate(it.current_period_start), periodEnd: toDate(it.current_period_end) },
    ];
    if (inv?.id && inv.status === 'paid') {
      events.push({ type: 'invoice_paid', subscriptionId: updated.id, invoiceId: inv.id, amountCents: inv.amount_paid, currency: inv.currency.toUpperCase(), kind: 'upgrade_proration', periodStart: null, periodEnd: null });
    }
    return events;
  }

  async scheduleDowngrade(i: { subscriptionId: string; toPriceId: string }) {
    const schedule = await this.stripe.subscriptionSchedules.create({ from_subscription: i.subscriptionId });
    const phase = schedule.phases[0]!;
    await this.stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        { items: phase.items.map((x) => ({ price: typeof x.price === 'string' ? x.price : x.price.id, quantity: x.quantity ?? 1 })), start_date: phase.start_date, end_date: phase.end_date },
        { items: [{ price: i.toPriceId, quantity: 1 }], duration: { interval: 'year', interval_count: 1 } },
      ],
    });
  }

  async parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent | null> {
    if (!signature) throw new Error('falta la firma de Stripe');
    const ev = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    switch (ev.type) {
      case 'checkout.session.completed': {
        const s = ev.data.object;
        if (s.mode !== 'subscription' || !s.subscription || !s.client_reference_id) return null;
        const sub = await this.stripe.subscriptions.retrieve(String(s.subscription));
        const it = sub.items.data[0]!;
        return {
          type: 'subscription_activated',
          userId: s.client_reference_id,
          plan: (s.metadata?.plan as PlanCode) ?? this.priceToPlan[it.price.id] ?? 'socio',
          customerId: String(s.customer),
          subscriptionId: sub.id,
          periodStart: toDate(it.current_period_start),
          periodEnd: toDate(it.current_period_end),
        };
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const inv = ev.data.object;
        const subId = inv.parent?.subscription_details?.subscription;
        if (!subId || !inv.id) return null;
        const subscriptionId = typeof subId === 'string' ? subId : subId.id;
        if (ev.type === 'invoice.payment_failed') {
          return { type: 'invoice_failed', subscriptionId, invoiceId: inv.id, amountCents: inv.amount_due, currency: inv.currency.toUpperCase() };
        }
        const line = inv.lines.data[0];
        return {
          type: 'invoice_paid',
          subscriptionId,
          invoiceId: inv.id,
          amountCents: inv.amount_paid,
          currency: inv.currency.toUpperCase(),
          kind: inv.billing_reason === 'subscription_cycle' ? 'renewal' : inv.billing_reason === 'subscription_update' ? 'upgrade_proration' : 'new',
          periodStart: line ? toDate(line.period.start) : null,
          periodEnd: line ? toDate(line.period.end) : null,
        };
      }
      case 'customer.subscription.updated': {
        const sub = ev.data.object;
        const it = sub.items.data[0]!;
        const plan = this.priceToPlan[it.price.id];
        if (!plan) return null;
        return { type: 'subscription_plan_changed', subscriptionId: sub.id, plan, periodStart: toDate(it.current_period_start), periodEnd: toDate(it.current_period_end) };
      }
      case 'customer.subscription.deleted':
        return { type: 'subscription_canceled', subscriptionId: ev.data.object.id };
      default:
        return null;
    }
  }
}

/**
 * Pagos simulados para desarrollo y pruebas automáticas. El "checkout" es una página propia
 * (/dev/checkout) que firma un token y aplica los mismos eventos normalizados que Stripe.
 */
export class FakePayments implements PaymentProvider {
  readonly kind = 'fake' as const;
  constructor(
    private readonly appUrl: string,
    private readonly secret: string,
  ) {}

  private sign(payload: string) {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  /** Token del checkout simulado: userId.plan.exp.firma */
  checkoutToken(userId: string, plan: PlanCode) {
    const body = `${userId}.${plan}.${Date.now() + 3_600_000}`;
    return `${body}.${this.sign(body)}`;
  }

  readCheckoutToken(token: string): { userId: string; plan: PlanCode } | null {
    const parts = token.split('.');
    if (parts.length !== 4) return null;
    const [userId, plan, exp, sig] = parts as [string, string, string, string];
    const expected = Buffer.from(this.sign(`${userId}.${plan}.${exp}`));
    if (expected.length !== Buffer.from(sig).length || !timingSafeEqual(expected, Buffer.from(sig))) return null;
    if (Number(exp) < Date.now() || (plan !== 'socio' && plan !== 'pro')) return null;
    return { userId, plan };
  }

  /** Eventos que produce un pago simulado exitoso. */
  completeCheckout(userId: string, plan: PlanCode, amountCents: number, now = new Date()): PaymentEvent[] {
    const end = new Date(now);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    const subscriptionId = `fake_sub_${userId}`;
    return [
      { type: 'subscription_activated', userId, plan, customerId: `fake_cus_${userId}`, subscriptionId, periodStart: now, periodEnd: end },
      { type: 'invoice_paid', subscriptionId, invoiceId: `fake_in_${userId}_${now.getTime()}`, amountCents, currency: 'USD', kind: 'new', periodStart: now, periodEnd: end },
    ];
  }

  async createCheckout(i: CheckoutInput) {
    return { url: `${this.appUrl}/dev/checkout?token=${encodeURIComponent(this.checkoutToken(i.userId, i.plan))}&next=${encodeURIComponent(i.successUrl)}` };
  }

  async upgrade(i: { subscriptionId: string; prorationCents: number }): Promise<PaymentEvent[]> {
    const now = new Date();
    return [{ type: 'invoice_paid', subscriptionId: i.subscriptionId, invoiceId: `fake_up_${now.getTime()}`, amountCents: i.prorationCents, currency: 'USD', kind: 'upgrade_proration', periodStart: null, periodEnd: null }];
  }

  async scheduleDowngrade() {}

  async parseWebhook() {
    return null;
  }
}

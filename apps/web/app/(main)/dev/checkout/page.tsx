import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { FakePayments } from '@pluma/adapters';
import { applyPaymentEvent, loadPlans } from '@pluma/services';
import { Card, ScreenTitle, buttonClass } from '@pluma/ui';
import { money } from '@/lib/format';
import { isDemoMode } from '@pluma/db/env';
import { deps, kickDispatch } from '@/lib/server';

/** Checkout simulado (solo desarrollo y pruebas automáticas): aplica los mismos eventos que Stripe. */
export default async function DevCheckout({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const d = deps();
  if (d.payments.kind !== 'fake') notFound();
  const fake = d.payments as FakePayments;
  const { token = '', next = '/' } = await searchParams;
  const parsed = fake.readCheckoutToken(token);
  if (!parsed) notFound();
  const plans = await loadPlans(d);
  const t = await getTranslations('devCheckout');
  const locale = await getLocale();
  const amount = plans[parsed.plan].amountCents;

  async function pay() {
    'use server';
    const dd = deps();
    const p = (dd.payments as FakePayments).readCheckoutToken(token);
    if (!p) return;
    for (const ev of (dd.payments as FakePayments).completeCheckout(p.userId, p.plan, amount)) await applyPaymentEvent(dd, ev);
    await kickDispatch();
    // Solo rutas internas: el dominio puede no coincidir con el de la URL de retorno (p. ej. otro despliegue).
    let target = '/';
    try {
      const u = new URL(next, 'http://pluma.local');
      if (u.pathname.startsWith('/') && !u.pathname.startsWith('//')) target = `${u.pathname}${u.search}`;
    } catch {}
    redirect(target);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-6 px-5">
      <ScreenTitle eyebrow={isDemoMode() ? 'Demo' : 'Stripe · test'} title={t('title')}>{t('body')}</ScreenTitle>
      <Card className="tabular text-3xl font-bold">{money(amount, locale)}</Card>
      <form action={pay}>
        <button className={buttonClass({ block: true })}>{t('pay', { amount: money(amount, locale) })}</button>
      </form>
    </main>
  );
}

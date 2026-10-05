import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { FakePayments } from '@pluma/adapters';
import { applyPaymentEvent, loadPlans } from '@pluma/services';
import { Card, ScreenTitle, buttonClass } from '@pluma/ui';
import { money } from '@/lib/format';
import { deps } from '@/lib/server';

/** Checkout simulado (solo desarrollo y pruebas automáticas): aplica los mismos eventos que Stripe. */
export default async function DevCheckout({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const d = deps();
  if (!(d.payments instanceof FakePayments)) notFound();
  const { token = '', next = '/' } = await searchParams;
  const parsed = d.payments.readCheckoutToken(token);
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
    const target = next.startsWith((process.env.PLUMA_APP_URL ?? 'http://localhost:3000')) || next.startsWith('/') ? next : '/';
    redirect(target);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-6 px-5">
      <ScreenTitle eyebrow="Stripe · test" title={t('title')}>{t('body')}</ScreenTitle>
      <Card className="tabular text-3xl font-bold">{money(amount, locale)}</Card>
      <form action={pay}>
        <button className={buttonClass({ block: true })}>{t('pay', { amount: money(amount, locale) })}</button>
      </form>
    </main>
  );
}

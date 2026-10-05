import { getLocale, getTranslations } from 'next-intl/server';
import { Card, ScreenTitle } from '@pluma/ui';
import { loadPlans } from '@pluma/services';
import { Lock } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { money, pct, planName } from '@/lib/format';
import { deps, requireStep } from '@/lib/server';
import { checkoutAction } from '../actions';
import { OnboardingProgress } from '../progress';

/** A9 · Pago anual por adelantado. */
export default async function PaymentStep() {
  const s = await requireStep('payment');
  const t = await getTranslations('onboarding.payment');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const plans = await loadPlans(deps());
  const plan = plans[s.membership!.plan];
  const country = s.profile?.country;
  const rows: [string, string][] = [
    [t('plan'), planName(s.membership!.plan, locale)],
    [t('commission'), pct(plan.commissionBps, locale, country)],
    [t('renews'), t('renewsValue')],
  ];
  return (
    <>
      <OnboardingProgress session={s} step="payment" />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <Card className="flex flex-col">
        <dl className="flex flex-col">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line py-3 text-sm">
              <dt className="text-fg-2">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-4">
            <dt className="text-fg-2">{t('total')}</dt>
            <dd className="tabular text-[28px] font-bold tracking-[-0.02em]">{money(plan.amountCents, locale, country)}</dd>
          </div>
        </dl>
      </Card>
      <ActionForm action={checkoutAction} submitLabel={t('pay', { amount: money(plan.amountCents, locale, country) })} pendingLabel={tc('sending')}
        footer={<p className="flex items-center justify-center gap-2 text-xs text-fg-2"><Lock size={14} strokeWidth={2} aria-hidden />{t('secure')}</p>} />
    </>
  );
}

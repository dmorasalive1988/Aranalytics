import { getLocale, getTranslations } from 'next-intl/server';
import { Card, HighlightCard, Notice, ScreenTitle } from '@pluma/ui';
import { loadPlans, membershipPayments } from '@pluma/services';
import { upgradeProrationCents } from '@pluma/domain';
import { CircleCheck } from 'lucide-react';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { date, money, pct, planName } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { downgradeAction, upgradeAction } from '../actions';

/** A46 · Mi plan: mejora inmediata a Pro con prorrateo visible, bajada al final del período, pagos. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ mejorado?: string }> }) {
  const { mejorado } = await searchParams;
  const s = await requireMember();
  const t = await getTranslations('account');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const country = s.profile?.country;
  const m = s.membership!;
  const plans = await loadPlans(deps());
  const payments = await membershipPayments(deps(), s.userId);
  const end = m.currentPeriodEnd ? date(m.currentPeriodEnd, locale, country) : '—';
  const proration = m.currentPeriodStart && m.currentPeriodEnd
    ? upgradeProrationCents({ periodStart: new Date(m.currentPeriodStart), periodEnd: new Date(m.currentPeriodEnd), now: new Date(), fromPriceCents: plans.socio.amountCents, toPriceCents: plans.pro.amountCents })
    : plans.pro.amountCents - plans.socio.amountCents;
  return (
    <>
      <BackLink href="/cuenta" label={tc('back')} />
      <ScreenTitle title={t('planTitle')} />
      <HighlightCard className="flex flex-col gap-1">
        <span className="text-[13px] font-medium">{t('current')}</span>
        <span className="font-display text-[34px] font-extrabold">{planName(m.plan, locale)}</span>
        <span className="text-sm">{t('commission', { pct: pct(plans[m.plan].commissionBps, locale, country) })} · {t('renews', { date: end })}</span>
      </HighlightCard>

      {mejorado !== undefined && m.plan === 'pro' && (
        <Notice tone="ok" icon={<CircleCheck size={20} strokeWidth={2} />} title={t('upgraded')}>
          {money(Number(mejorado) || 0, locale, country)}
        </Notice>
      )}
      {m.plan === 'socio' && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold">{t('upgradeTitle')}</h2>
          <p className="text-sm text-fg-3">{t('upgradeBody', { amount: money(proration, locale, country) })}</p>
          <ActionForm action={upgradeAction} submitLabel={t('upgradeCta', { amount: money(proration, locale, country) })} pendingLabel={tc('sending')} />
        </Card>
      )}
      {m.plan === 'pro' && !m.scheduledPlan && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">{t('downgradeTitle')}</h2>
          <p className="text-sm text-fg-3">{t('downgradeBody', { date: end })}</p>
          <ActionForm action={downgradeAction} submitLabel={t('downgradeCta')} submitVariant="secondary" pendingLabel={tc('sending')} />
        </Card>
      )}
      {m.plan === 'pro' && m.scheduledPlan === 'socio' && (
        <Notice tone="info" title={t('downgradeScheduled', { date: end })}>
          <ActionForm action={upgradeAction} submitLabel={t('keepPro')} submitVariant="secondary" />
        </Notice>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="pay-title">
        <h2 id="pay-title" className="text-[15px] font-bold">{t('payments')}</h2>
        {payments.length === 0 ? <p className="text-sm text-fg-2">{t('noPayments')}</p> : (
          <ul className="flex flex-col">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 border-b border-line py-3 text-sm last:border-0">
                <span className="flex flex-col"><span>{t(`paymentKinds.${p.kind as 'new'}`)}</span><span className="text-xs text-fg-2">{date(p.occurredAt, locale, country)}</span></span>
                <span className="tabular font-bold">{money(p.amountCents, locale, country, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { ScreenTitle } from '@pluma/ui';
import { loadPlans } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { money, pct, planName } from '@/lib/format';
import { PLAN_COOKIE } from '@/lib/plan-cookie';
import { deps, requireStep } from '@/lib/server';
import { planAction } from '../actions';
import { OnboardingProgress } from '../progress';
import { PlanPicker } from './plan-picker';

/** A7 · Elige tu plan (Socio o Pro), con la comisión explicada con un ejemplo de USD 100. */
export default async function PlanStep() {
  const s = await requireStep('plan', 'contract', 'payment');
  const t = await getTranslations('onboarding.plan');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const plans = await loadPlans(deps());
  const fromSite = (await cookies()).get(PLAN_COOKIE)?.value;
  const chosen = s.membership?.plan ?? (fromSite === 'socio' || fromSite === 'pro' ? fromSite : 'pro');
  const country = s.profile?.country;
  const card = (code: 'socio' | 'pro') => {
    const p = plans[code];
    const net = money(10000 - Math.round((10000 * p.commissionBps) / 10000), locale, country).replace(/^USD\s/, '');
    return {
      code,
      name: planName(code, locale),
      price: money(p.amountCents, locale, country),
      perYear: t('perYear'),
      commission: t('commission', { pct: pct(p.commissionBps, locale, country) }),
      example: t('example', { net }),
      recommended: code === 'pro' ? t('recommended') : undefined,
      features: code === 'socio'
        ? [t('features.registration'), t('features.statements'), t('features.splits'), t('features.network')]
        : [t('features.allSocio'), t('features.sync'), t('features.ar'), t('features.analytics')],
    };
  };
  return (
    <>
      <BackLink href={s.minor ? '/onboarding/tutor' : '/onboarding/sociedad'} label={tc('back')} />
      <OnboardingProgress session={s} step="plan" />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <ActionForm action={planAction} submitLabel={tc('continue')} pendingLabel={tc('sending')}>
        <PlanPicker plans={[card('socio'), card('pro')]} initial={chosen} legend={t('title')} />
        <p className="text-sm text-fg-2">{t('ownership')}</p>
      </ActionForm>
    </>
  );
}

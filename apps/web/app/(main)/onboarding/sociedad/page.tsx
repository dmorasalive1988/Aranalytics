import { getTranslations } from 'next-intl/server';
import { PRO_SOCIETIES } from '@pluma/domain';
import { Field, Input, ScreenTitle } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { requireStep } from '@/lib/server';
import { societyAction } from '../actions';
import { OnboardingProgress } from '../progress';
import { SocietyFields } from './society-fields';

/** A5 · Sociedad de gestión e IPI. */
export default async function SocietyStep() {
  const s = await requireStep('society', 'guardian', 'plan', 'contract', 'payment');
  const t = await getTranslations('onboarding.society');
  const tc = await getTranslations('common');
  const p = s.profile!;
  const country = p.country;
  const sorted = [...PRO_SOCIETIES].sort((a, b) => Number(b.country === country) - Number(a.country === country)).map((x) => x.code);
  const initial = p.societyCode ?? (p.societyOther === 'NONE' ? 'NONE' : p.societyOther ? 'OTHER' : (sorted[0] ?? 'OTHER'));
  return (
    <>
      <BackLink href="/onboarding/perfil" label={tc('back')} />
      <OnboardingProgress session={s} step="society" />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <ActionForm action={societyAction} submitLabel={tc('continue')} pendingLabel={tc('sending')}>
        <SocietyFields societies={sorted} initial={initial} labels={{ label: t('label'), other: t('other'), otherName: t('otherName'), none: t('none'), noneHint: t('noneHint'), initialOther: p.societyOther && p.societyOther !== 'NONE' ? p.societyOther : '' }} />
        <Field id="ipi" label={t('ipi')} hint={t('ipiHint')} optional={tc('optional')}>
          <Input id="ipi" name="ipi" inputMode="numeric" defaultValue={p.ipi ?? ''} hasHint />
        </Field>
      </ActionForm>
    </>
  );
}

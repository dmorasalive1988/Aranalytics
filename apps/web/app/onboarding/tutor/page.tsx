import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Field, Input, ScreenTitle, Select } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { requireStep } from '@/lib/server';
import { guardianAction } from '../actions';
import { OnboardingProgress } from '../progress';

/** A6 · Tutor legal (solo menores de edad). */
export default async function GuardianStep() {
  const s = await requireStep('guardian', 'plan', 'contract', 'payment');
  if (!s.minor) redirect('/onboarding/plan');
  const t = await getTranslations('onboarding.guardian');
  const tc = await getTranslations('common');
  const g = s.guardian;
  return (
    <>
      <BackLink href="/onboarding/sociedad" label={tc('back')} />
      <OnboardingProgress session={s} step="guardian" />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <ActionForm action={guardianAction} submitLabel={tc('continue')} pendingLabel={tc('sending')}>
        <Field id="name" label={t('name')}>
          <Input id="name" name="name" defaultValue={g?.legalName} required />
        </Field>
        <Field id="email" label={t('email')}>
          <Input id="email" name="email" type="email" inputMode="email" defaultValue={g?.email} required />
        </Field>
        <Field id="relationship" label={t('relationship')}>
          <Select id="relationship" name="relationship" defaultValue={g?.relationship ?? 'madre'}>
            {(['madre', 'padre', 'tutor'] as const).map((r) => (
              <option key={r} value={r}>{t(`relationships.${r}`)}</option>
            ))}
          </Select>
        </Field>
      </ActionForm>
    </>
  );
}

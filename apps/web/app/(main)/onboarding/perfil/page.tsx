import { getLocale, getTranslations } from 'next-intl/server';
import { LAUNCH_COUNTRIES } from '@pluma/domain';
import { Field, Input, ScreenTitle, Select } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { requireStep } from '@/lib/server';
import { profileAction } from '../actions';
import { OnboardingProgress } from '../progress';

/** A4 · Datos del autor. */
export default async function ProfileStep() {
  const s = await requireStep('profile', 'society', 'guardian', 'plan', 'contract', 'payment');
  const t = await getTranslations('onboarding.profile');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  const p = s.profile;
  return (
    <>
      <OnboardingProgress session={s} step="profile" />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <ActionForm action={profileAction} submitLabel={tc('continue')} pendingLabel={tc('sending')}>
        <Field id="legalName" label={t('legalName')} hint={t('legalNameHint')}>
          <Input id="legalName" name="legalName" autoComplete="name" defaultValue={p?.legalName} required hasHint />
        </Field>
        <Field id="artistName" label={t('artistName')} optional={tc('optional')}>
          <Input id="artistName" name="artistName" defaultValue={p?.artistName ?? ''} />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="country" label={t('country')}>
            <Select id="country" name="country" defaultValue={p?.country ?? (locale === 'pt-BR' ? 'BR' : locale === 'en' ? 'US' : 'CO')} required>
              {LAUNCH_COUNTRIES.map((c) => (
                <option key={c} value={c}>{regions.of(c)}</option>
              ))}
            </Select>
          </Field>
          <Field id="city" label={t('city')} optional={tc('optional')}>
            <Input id="city" name="city" autoComplete="address-level2" defaultValue={p?.city ?? ''} />
          </Field>
        </div>
        <Field id="birthDate" label={t('birthDate')} hint={t('birthHint')}>
          <Input id="birthDate" name="birthDate" type="date" autoComplete="bday" defaultValue={p?.birthDate} required hasHint />
        </Field>
      </ActionForm>
    </>
  );
}

import { getLocale, getTranslations } from 'next-intl/server';
import { Field, Input, PlumaLogo, ScreenTitle, Select } from '@pluma/ui';
import { catalog } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { deps, requireUser } from '@/lib/server';
import { registerBuyerAction } from '../actions';

const COUNTRIES = ['MX', 'CO', 'AR', 'CL', 'PE', 'EC', 'BR', 'US', 'ES', 'PR', 'DO', 'GT', 'CR', 'PA', 'UY', 'VE', 'BO', 'PY', 'SV', 'HN', 'NI', 'CA', 'GB'];
const TYPES = ['agency', 'production', 'brand', 'supervisor', 'other'] as const;

/** D1 · Alta de comprador: empresa, tipo y país. */
export default async function BuyerSignup() {
  const s = await requireUser('/pluma-sync/alta');
  const t = await getTranslations('plumaSync');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  const current = await catalog.buyerProfile(deps(), s.userId);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 py-10">
      <PlumaLogo size={26} product="sync" />
      <ScreenTitle title={t('altaTitle')}>{t('altaSub')}</ScreenTitle>
      <ActionForm action={registerBuyerAction} submitLabel={t('altaCta')}>
        <Field id="company" label={t('company')}><Input id="company" name="company" required defaultValue={current?.company} autoComplete="organization" /></Field>
        <Field id="type" label={t('companyType')}>
          <Select id="type" name="type" defaultValue={current?.companyType ?? 'agency'}>{TYPES.map((x) => <option key={x} value={x}>{tc(`companyTypes.${x}`)}</option>)}</Select>
        </Field>
        <Field id="country" label={t('country')}>
          <Select id="country" name="country" defaultValue={current?.country ?? 'MX'}>{COUNTRIES.map((c) => <option key={c} value={c}>{regions.of(c)}</option>)}</Select>
        </Field>
      </ActionForm>
    </main>
  );
}

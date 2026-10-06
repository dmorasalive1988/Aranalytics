import { getLocale, getTranslations } from 'next-intl/server';
import { LAUNCH_COUNTRIES } from '@pluma/domain';
import { Card, Field, Input, Notice, ScreenTitle, Select } from '@pluma/ui';
import { CircleCheck, Clock } from 'lucide-react';
import { payouts } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { money } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { kycAction, methodAction, payoutAction, taxAction } from '../actions';

const CURRENCIES = ['USD', 'COP', 'MXN', 'BRL', 'PEN', 'CLP', 'ARS', 'EUR'];

/** A11 + A12 + A17 · Datos para cobrar y solicitud de retiro. */
export default async function Withdraw() {
  const s = await requireMember();
  const t = await getTranslations('withdraw');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const country = s.profile?.country;
  const r = await payouts.payoutReadiness(deps(), s.userId);
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  const step = (n: string, done: boolean, children: React.ReactNode) => (
    <Card className="flex flex-col gap-4">
      <h2 className="flex items-center justify-between font-display text-lg font-extrabold">
        {n}
        {done && <CircleCheck size={22} strokeWidth={2} className="text-ok-fg" aria-hidden />}
      </h2>
      {children}
    </Card>
  );
  return (
    <>
      <BackLink href="/pagos" label={tc('back')} />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>

      {step(t('kycTitle'), r.kyc === 'approved', r.kyc === 'approved' ? <p className="text-sm text-ok-fg">{t('kycApproved')}</p>
        : r.kyc === 'pending' ? <Notice tone="info" icon={<Clock size={20} strokeWidth={2} />} title={t('kycPending')} />
        : r.kyc === 'rejected' ? <Notice tone="alert" title={t('kycRejected')} />
        : <ActionForm action={kycAction} submitLabel={t('kycStart')} submitVariant="secondary" pendingLabel={tc('sending')}><p className="text-sm text-fg-3">{t('kycNotStarted')}</p></ActionForm>)}

      {step(t('taxTitle'), !!r.tax, (
        <ActionForm action={taxAction} submitLabel={t('saveData')} submitVariant="secondary" pendingLabel={tc('sending')}>
          {r.tax && <p className="text-sm text-ok-fg">{t('taxSaved', { last4: r.tax.last4 ?? '' })}</p>}
          <Field id="taxCountry" label={t('taxCountry')}>
            <Select id="taxCountry" name="taxCountry" defaultValue={r.tax?.country ?? country ?? 'CO'}>
              {LAUNCH_COUNTRIES.map((c) => <option key={c} value={c}>{regions.of(c)}</option>)}
            </Select>
          </Field>
          <Field id="taxId" label={t('taxId')} hint={t('taxIdHint')}><Input id="taxId" name="taxId" autoComplete="off" required hasHint /></Field>
          <Field id="entity" label={t('entity')}>
            <Select id="entity" name="entity"><option value="individual">{t('individual')}</option><option value="company">{t('company')}</option></Select>
          </Field>
        </ActionForm>
      ))}

      {step(t('methodTitle'), !!r.method, (
        <ActionForm action={methodAction} submitLabel={t('saveData')} submitVariant="secondary" pendingLabel={tc('sending')}>
          {r.method && <p className="text-sm text-ok-fg">{t('methodSaved', { label: r.method.label })}</p>}
          <Field id="provider" label={t('provider')}><Select id="provider" name="provider"><option value="wise">Wise</option><option value="payoneer">Payoneer</option></Select></Field>
          <Field id="holder" label={t('holder')}><Input id="holder" name="holder" defaultValue={s.profile?.legalName} required /></Field>
          <Field id="account" label={t('account')}><Input id="account" name="account" autoComplete="off" required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="bank" label={t('bank')} optional={tc('optional')}><Input id="bank" name="bank" /></Field>
            <Field id="currency" label={t('currency')}><Select id="currency" name="currency" defaultValue={country === 'BR' ? 'BRL' : country === 'MX' ? 'MXN' : country === 'US' ? 'USD' : 'COP'}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          </div>
        </ActionForm>
      ))}

      {step(t('amountTitle'), false, (
        <ActionForm action={payoutAction} submitLabel={t('request')} pendingLabel={tc('sending')} submitDisabled={r.kyc !== 'approved' || !r.tax || !r.method || r.balanceCents < r.minimumCents}>
          <Field id="amount" label={t('amount')} hint={t('amountHint', { min: money(r.minimumCents, locale, country), balance: money(r.balanceCents, locale, country) })}>
            <Input id="amount" name="amount" inputMode="decimal" defaultValue={r.balanceCents > 0 ? (r.balanceCents / 100).toFixed(2) : ''} className="tabular" required hasHint />
          </Field>
        </ActionForm>
      ))}
    </>
  );
}

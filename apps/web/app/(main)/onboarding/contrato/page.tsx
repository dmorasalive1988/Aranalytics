import { getTranslations } from 'next-intl/server';
import { Card, Field, Input, ScreenTitle } from '@pluma/ui';
import { currentAdminAgreement } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { SimpleMarkdown } from '@/components/markdown';
import { deps, requireStep } from '@/lib/server';
import { guardianCodeAction, guardianSignAction, signContractAction } from '../actions';
import { OnboardingProgress } from '../progress';

function AcceptBox({ label }: { label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-snug">
      <input type="checkbox" name="accept" required className="mt-0.5 h-6 w-6 shrink-0 accent-[#F2A541]" />
      <span>{label}</span>
    </label>
  );
}

/** A8 · Contrato de administración en lenguaje claro y firma con evidencia (o del tutor, si es menor). */
export default async function ContractStep() {
  const s = await requireStep('contract');
  const t = await getTranslations('onboarding.contract');
  const tc = await getTranslations('common');
  const doc = await currentAdminAgreement(deps(), s.locale);
  return (
    <>
      <BackLink href="/onboarding/plan" label={tc('back')} />
      <OnboardingProgress session={s} step="contract" />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <Card className="max-h-[46dvh] overflow-y-auto" tabIndex={0} aria-label={t('title')}>
        <SimpleMarkdown text={doc.body} />
      </Card>
      <p className="break-all text-xs text-fg-2">SHA-256 · <span className="tabular">{doc.sha256}</span></p>
      {!s.minor ? (
        <ActionForm action={signContractAction} submitLabel={t('sign')} pendingLabel={tc('sending')}>
          <AcceptBox label={t('accept')} />
        </ActionForm>
      ) : (
        <div className="flex flex-col gap-6">
          <ScreenTitle title={t('guardianTitle')}>{t('guardianSub', { email: s.guardian?.email ?? '' })}</ScreenTitle>
          <ActionForm action={guardianCodeAction} submitLabel={t('sendCode')} submitVariant="secondary" pendingLabel={tc('sending')}>
            <AcceptBox label={t('accept')} />
          </ActionForm>
          <ActionForm action={guardianSignAction} submitLabel={t('signAsGuardian')} pendingLabel={tc('sending')}>
            <Field id="code" label={t('guardianCode')}>
              <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="text-center text-2xl tracking-[0.4em] tabular" />
            </Field>
          </ActionForm>
        </div>
      )}
    </>
  );
}

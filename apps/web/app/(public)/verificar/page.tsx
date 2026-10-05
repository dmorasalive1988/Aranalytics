import { getTranslations } from 'next-intl/server';
import { Field, Input, ScreenTitle } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { resendAction, verifyAction } from '../actions';

/** A3 · Verifica tu correo con el código de 6 dígitos. */
export default async function Verify({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams;
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  return (
    <div className="flex flex-col gap-7">
      <BackLink href="/registro" label={tc('back')} />
      <ScreenTitle title={t('verifyTitle')}>{t('verifySub', { email })}</ScreenTitle>
      <ActionForm action={verifyAction} submitLabel={t('verify')} pendingLabel={tc('sending')}>
        <input type="hidden" name="email" value={email} />
        <Field id="code" label={t('code')}>
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="text-center text-2xl tracking-[0.4em] tabular" />
        </Field>
      </ActionForm>
      <ActionForm action={resendAction} submitLabel={t('resend')} submitVariant="ghost">
        <input type="hidden" name="email" value={email} />
      </ActionForm>
    </div>
  );
}

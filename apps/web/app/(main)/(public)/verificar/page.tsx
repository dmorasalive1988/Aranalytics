import { getTranslations } from 'next-intl/server';
import { listDemoMail } from '@pluma/adapters';
import { isDemoMode } from '@pluma/db/env';
import { Field, Input, Notice, ScreenTitle } from '@pluma/ui';
import { deps } from '@/lib/server';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { resendAction, verifyAction } from '../actions';

/** A3 · Verifica tu correo con el código de 6 dígitos. */
export default async function Verify({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const { email = '', next } = await searchParams;
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  // Demo: no sale correo real, así que el código se muestra aquí.
  const demoCode = isDemoMode() && email ? (await listDemoMail(deps().db, { recipient: email, tag: 'auth_code', limit: 1 }))[0]?.subject.match(/\b(\d{6})\b/)?.[1] : undefined;
  const td = await getTranslations('demo');
  return (
    <div className="flex flex-col gap-7">
      <BackLink href="/registro" label={tc('back')} />
      <ScreenTitle title={t('verifyTitle')}>{t('verifySub', { email })}</ScreenTitle>
      {demoCode && <Notice tone="info" title={td('code', { code: demoCode })} />}
      <ActionForm action={verifyAction} submitLabel={t('verify')} pendingLabel={tc('sending')}>
        <input type="hidden" name="email" value={email} />
        {next && <input type="hidden" name="next" value={next} />}
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

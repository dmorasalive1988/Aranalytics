import { getTranslations } from 'next-intl/server';
import { listDemoMail } from '@pluma/adapters';
import { isDemoMode } from '@pluma/db/env';
import { Field, Input, Notice, ScreenTitle } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { deps } from '@/lib/server';
import { resendResetAction, resetAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('auth'))('resetTitle') };
}

/** Restablecer: código de 6 dígitos + contraseña nueva. Al terminar, la sesión queda iniciada. */
export default async function Reset({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams;
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  // Demo: no sale correo real, así que el código se muestra aquí.
  const demoCode = isDemoMode() && email ? (await listDemoMail(deps().db, { recipient: email, tag: 'password_reset', limit: 1 }))[0]?.subject.match(/\b(\d{6})\b/)?.[1] : undefined;
  return (
    <div className="flex flex-col gap-7">
      <BackLink href="/olvide" label={tc('back')} />
      <ScreenTitle title={t('resetTitle')}>{t('resetSub', { email })}</ScreenTitle>
      {demoCode && <Notice tone="info" title={(await getTranslations('demo'))('code', { code: demoCode })} />}
      <ActionForm action={resetAction} submitLabel={t('resetCta')} pendingLabel={tc('sending')}>
        <input type="hidden" name="email" value={email} />
        <Field id="code" label={t('code')}>
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="text-center text-2xl tracking-[0.4em] tabular" />
        </Field>
        <Field id="password" label={t('newPassword')} hint={t('passwordHint')}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required hasHint />
        </Field>
      </ActionForm>
      <ActionForm action={resendResetAction} submitLabel={t('resend')} submitVariant="ghost">
        <input type="hidden" name="email" value={email} />
      </ActionForm>
    </div>
  );
}

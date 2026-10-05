import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Field, Input, ScreenTitle, buttonClass } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { authMode } from '@/lib/server';
import { oauthAction, signInAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('auth'))('login') };
}

/** A2 · Entrar. */
export default async function SignIn() {
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  return (
    <div className="flex flex-col gap-7">
      <BackLink href="/bienvenida" label={tc('back')} />
      <ScreenTitle title={t('loginTitle')} />
      {authMode() === 'supabase' && (
        <div className="flex flex-col gap-3">
          <form action={oauthAction.bind(null, 'google')}>
            <button className={buttonClass({ variant: 'secondary', block: true })}>{t('google')}</button>
          </form>
          <form action={oauthAction.bind(null, 'apple')}>
            <button className={buttonClass({ variant: 'secondary', block: true })}>{t('apple')}</button>
          </form>
          <p className="text-center text-sm text-fg-2">{t('or')}</p>
        </div>
      )}
      <ActionForm action={signInAction} submitLabel={t('login')} pendingLabel={tc('sending')}
        footer={<p className="text-center text-sm text-fg-2">{t('noAccount')} <Link href="/registro" className="font-bold">{t('createAccount')}</Link></p>}>
        <Field id="email" label={t('email')}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field id="password" label={t('password')}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      </ActionForm>
    </div>
  );
}

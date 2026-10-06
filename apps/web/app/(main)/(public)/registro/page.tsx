import Link from 'next/link';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { Field, Input, ScreenTitle, StatusPill, buttonClass } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { planName } from '@/lib/format';
import { PLAN_COOKIE } from '@/lib/plan-cookie';
import { authMode } from '@/lib/server';
import { oauthAction, signUpAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('auth'))('signupTitle') };
}

/** A2 · Registro con correo o Google/Apple. */
export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  const plan = (await cookies()).get(PLAN_COOKIE)?.value;
  const chosen = plan === 'socio' || plan === 'pro' ? plan : null;
  return (
    <div className="flex flex-col gap-7">
      <BackLink href="/bienvenida" label={tc('back')} />
      <ScreenTitle title={t('signupTitle')}>{t('signupSub')}</ScreenTitle>
      {chosen && (
        <p className="flex items-center gap-2 text-sm text-fg-3">
          <StatusPill tone={chosen === 'pro' ? 'ambar' : 'niebla'}>{planName(chosen, await getLocale())}</StatusPill>
          {t('planChosen', { plan: planName(chosen, await getLocale()) })}
        </p>
      )}
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
      <ActionForm action={signUpAction} submitLabel={t('createAccount')} pendingLabel={tc('sending')}
        footer={<p className="text-center text-sm text-fg-2">{t('haveAccount')} <Link href={sp.next ? `/entrar?next=${encodeURIComponent(sp.next)}` : "/entrar"} className="font-bold">{t('login')}</Link></p>}>
        {sp.next && <input type="hidden" name="next" value={sp.next} />}
        <Field id="email" label={t('email')}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={sp.email} />
        </Field>
        <Field id="password" label={t('password')} hint={t('passwordHint')}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required hasHint />
        </Field>
      </ActionForm>
    </div>
  );
}

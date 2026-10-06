'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DomainError } from '@pluma/domain';
import { isLocale } from '@pluma/i18n';
import { ensureAppUser, getSession } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { currentLocale, deps, getAuth, setLocaleCookie, STEP_PATH } from '@/lib/server';

export async function signUpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email').toLowerCase();
  return run(async () => {
    await (await getAuth()).signUp(email, str(fd, 'password'), await currentLocale());
    redirect(`/verificar?email=${encodeURIComponent(email)}`);
  });
}

export async function verifyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await (await getAuth()).verifyEmail(str(fd, 'email'), str(fd, 'code'));
    await ensureAppUser(deps(), user, await currentLocale());
    redirect(STEP_PATH.profile);
  });
}

export async function resendAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await (await getAuth()).resendVerification(str(fd, 'email'), await currentLocale());
    return { ok: (await getTranslations('auth'))('resent') };
  });
}

export async function signInAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await (await getAuth()).signIn(str(fd, 'email'), str(fd, 'password'));
    await ensureAppUser(deps(), user, await currentLocale());
    const s = await getSession(deps(), user.id);
    if (s && isLocale(s.locale)) await setLocaleCookie(s.locale);
    redirect(s ? STEP_PATH[s.step] : STEP_PATH.profile);
  });
}

export async function oauthAction(provider: 'google' | 'apple') {
  const base = deps().appUrl;
  const url = await (await getAuth()).oauthUrl(provider, `${base}/auth/callback`);
  redirect(url);
}

export async function signOutAction() {
  await (await getAuth()).signOut();
  redirect('/bienvenida');
}

export async function forgotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email').toLowerCase();
  return run(async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('EMAIL_INVALID');
    await (await getAuth()).requestPasswordReset(email, await currentLocale());
    redirect(`/restablecer?email=${encodeURIComponent(email)}`);
  });
}

export async function resetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await (await getAuth()).resetPassword(str(fd, 'email'), str(fd, 'code'), String(fd.get('password') ?? ''));
    await ensureAppUser(deps(), user, await currentLocale());
    const s = await getSession(deps(), user.id);
    if (s && isLocale(s.locale)) await setLocaleCookie(s.locale);
    redirect(s ? STEP_PATH[s.step] : STEP_PATH.profile);
  });
}

export async function resendResetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await (await getAuth()).requestPasswordReset(str(fd, 'email'), await currentLocale());
    return { ok: (await getTranslations('auth'))('resetResent') };
  });
}

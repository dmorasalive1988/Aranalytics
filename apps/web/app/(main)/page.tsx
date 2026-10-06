import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LOCALE_COOKIE, negotiateLocale } from '@pluma/i18n';
import { getSession } from '@pluma/services';
import { deps, getAuth, STEP_PATH } from '@/lib/server';
import { siteLangFor } from '@/site/i18n';

/** Punto de entrada: visitantes al sitio en su idioma (elegido o del navegador); con sesión, a la app. */
export default async function Root() {
  const user = await (await getAuth()).getUser();
  if (!user) {
    const chosen = (await cookies()).get(LOCALE_COOKIE)?.value ?? negotiateLocale((await headers()).get('accept-language'));
    redirect(`/${siteLangFor(chosen)}`);
  }
  if (!user.emailVerified) redirect(`/verificar?email=${encodeURIComponent(user.email)}`);
  const s = await getSession(deps(), user.id);
  redirect(s ? STEP_PATH[s.step] : STEP_PATH.profile);
}

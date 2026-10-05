import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { isLocale, LOCALE_COOKIE, MESSAGES, negotiateLocale } from '@pluma/i18n';

/** Idioma sin prefijo en la URL: cookie (fijada desde el perfil o la bienvenida) o el navegador. */
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie) ? fromCookie : negotiateLocale((await headers()).get('accept-language'));
  return { locale, messages: MESSAGES[locale], timeZone: 'America/Bogota' };
});

import type { Locale } from '@pluma/i18n';
import en from '@pluma/i18n/site/en.json';
import es from '@pluma/i18n/site/es.json';
import pt from '@pluma/i18n/site/pt.json';
import { SITE_LANGS, type SiteLang } from './config';

export { SITE_LANGS, NUMBER_LOCALE, LEGAL_SLUGS, fmt, type SiteLang } from './config';

export type SiteDict = typeof es;

const DICTS: Record<SiteLang, SiteDict> = { es, en, pt };

/** Idioma de la app (cookie PLUMA_LOCALE) que corresponde a cada idioma del sitio. */
export const APP_LOCALE: Record<SiteLang, Locale> = { es: 'es', en: 'en', pt: 'pt-BR' };
export const HTML_LANG: Record<SiteLang, string> = { es: 'es', en: 'en', pt: 'pt-BR' };

export const isSiteLang = (s: unknown): s is SiteLang => typeof s === 'string' && (SITE_LANGS as readonly string[]).includes(s);

export function siteLangFor(locale: string | null | undefined): SiteLang {
  const l = locale === 'pt-BR' ? 'pt' : locale;
  return isSiteLang(l) ? l : 'es';
}

export function dict(lang: SiteLang): SiteDict {
  return DICTS[lang];
}

/** Lanzamiento con lista de espera (PLUMA_WAITLIST=1 al construir): los botones de registro llevan al formulario de correo. */
export const waitlistOn = () => process.env.PLUMA_WAITLIST === '1';
export const WAITLIST_ID = 'lista-de-espera';

/** Registro en la app con idioma (y plan) preseleccionados; el proxy guarda ambos en cookies. */
export function registerHref(lang: SiteLang, plan?: 'socio' | 'pro') {
  if (waitlistOn()) return `#${WAITLIST_ID}`;
  return `/registro?lang=${lang}${plan ? `&plan=${plan}` : ''}`;
}

export function siteUrl() {
  const explicit = process.env.PLUMA_SITE_URL ?? process.env.PLUMA_APP_URL;
  if (explicit && !(process.env.VERCEL && /localhost/.test(explicit))) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}

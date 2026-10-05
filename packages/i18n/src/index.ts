import en from '../messages/en.json';
import es from '../messages/es.json';
import ptBR from '../messages/pt-BR.json';

export const LOCALES = ['es', 'en', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const LOCALE_COOKIE = 'PLUMA_LOCALE';

export type Messages = typeof es;
export const MESSAGES: Record<Locale, Messages> = { es, en, 'pt-BR': ptBR };

export const isLocale = (s: unknown): s is Locale => typeof s === 'string' && (LOCALES as readonly string[]).includes(s);

/** Idioma preferido a partir de Accept-Language (es, en, pt → pt-BR). */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0]!.trim().toLowerCase();
    if (tag.startsWith('pt')) return 'pt-BR';
    if (tag.startsWith('en')) return 'en';
    if (tag.startsWith('es')) return 'es';
  }
  return DEFAULT_LOCALE;
}

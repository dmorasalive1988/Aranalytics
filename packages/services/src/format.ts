export type AppLocale = 'es' | 'en' | 'pt-BR';

/** Idioma de la interfaz + país del perfil → configuración regional de Intl (montos y fechas). */
export function intlLocale(locale: AppLocale, country?: string | null): string {
  if (locale === 'pt-BR') return 'pt-BR';
  if (locale === 'en') return 'en-US';
  const c = (country ?? 'CO').toUpperCase();
  return ['CO', 'MX', 'AR', 'CL', 'PE', 'EC', 'US', 'ES', 'VE', 'UY', 'PY', 'BO', 'DO', 'GT', 'CR', 'PA', 'PR', 'SV', 'HN', 'NI'].includes(c) ? `es-${c}` : 'es-419';
}

export function formatMoney(cents: number, currency: string, locale: AppLocale, country?: string | null): string {
  const n = new Intl.NumberFormat(intlLocale(locale, country), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  return `${currency} ${n}`;
}

export function formatDate(d: Date | string, locale: AppLocale, country?: string | null): string {
  return new Intl.DateTimeFormat(intlLocale(locale, country), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d));
}

export const isAppLocale = (s: unknown): s is AppLocale => s === 'es' || s === 'en' || s === 'pt-BR';

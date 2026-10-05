import { formatBps } from '@pluma/domain';
import { formatDate, formatMoney, intlLocale, type AppLocale } from '@pluma/services';

export const money = (cents: number, locale: string, country?: string | null, currency = 'USD') => formatMoney(cents, currency, locale as AppLocale, country);
export const pct = (bps: number, locale: string, country?: string | null) => formatBps(bps, intlLocale(locale as AppLocale, country));
export const date = (d: string | Date, locale: string, country?: string | null) => formatDate(d, locale as AppLocale, country);
export const planName = (code: 'socio' | 'pro', locale: string) => (code === 'pro' ? 'Pro' : locale === 'pt-BR' ? 'Sócio' : 'Socio');

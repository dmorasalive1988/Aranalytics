/** Porcentajes en puntos básicos: 10000 = 100,00 %. Nunca flotantes en reglas de negocio. */
export const BPS_TOTAL = 10_000;

/**
 * Convierte lo que escribe una persona ("12,5", "12.50", "33 %") a puntos básicos.
 * Devuelve null si no es un porcentaje válido entre 0 y 100 con como máximo 2 decimales.
 */
export function parsePercentToBps(input: string): number | null {
  const s = input.trim().replace(/\s*%$/, '').replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  const bps = Number(int) * 100 + Number(frac.padEnd(2, '0'));
  return bps <= BPS_TOTAL ? bps : null;
}

/** Formatea puntos básicos como porcentaje según el idioma ("12,5 %", "12.5%"). */
export function formatBps(bps: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(bps / BPS_TOTAL);
}

/** Puntos básicos a texto editable sin símbolo ("12,5" en es/pt, "12.5" en en). */
export function bpsToInput(bps: number, locale: string): string {
  const s = (bps / 100).toFixed(2).replace(/\.?0+$/, '');
  return locale.startsWith('en') ? s : s.replace('.', ',');
}

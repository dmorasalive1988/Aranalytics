import Decimal from 'decimal.js';

/**
 * Aritmética de dinero. Nunca flotantes: Decimal con 6 decimales para líneas y distribuciones,
 * enteros (centavos) para statements y saldos.
 */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

export const SCALE = 6;
export const dec = (v: Decimal.Value) => new D(v);
export const q6 = (v: Dec) => v.toDecimalPlaces(SCALE, D.ROUND_HALF_UP);
export const toCentsHalfUp = (v: Dec) => v.times(100).toDecimalPlaces(0, D.ROUND_HALF_UP).toNumber();

/**
 * Método del mayor residuo: reparte `total` (en unidades enteras de `unit`) entre valores exactos de
 * modo que la suma de lo asignado sea EXACTAMENTE `total`. Determinista: a igual residuo gana el
 * primero en el orden recibido. Acepta valores negativos.
 */
export function largestRemainder(values: Dec[], unit: Dec, total: Dec): Dec[] {
  const units = values.map((v) => v.div(unit));
  const floors = units.map((u) => u.floor());
  const assigned = floors.reduce((a, b) => a.plus(b), dec(0));
  const target = total.div(unit);
  if (!target.isInteger()) throw new Error('total debe ser múltiplo de la unidad');
  let missing = target.minus(assigned).toNumber();
  const order = units
    .map((u, i) => ({ i, r: u.minus(floors[i]!) }))
    .sort((a, b) => b.r.comparedTo(a.r) || a.i - b.i);
  const out = floors.slice();
  if (missing < 0 || missing > values.length) throw new Error(`residuo imposible de repartir: ${missing}`);
  for (const { i } of order) {
    if (missing === 0) break;
    out[i] = out[i]!.plus(1);
    missing--;
  }
  return out.map((u) => u.times(unit));
}

/** Reparte un monto entre participaciones en puntos básicos, a 6 decimales, sin perder nada. */
export function splitByBps(amount: Dec, bps: number[]): Dec[] {
  const exact = bps.map((b) => amount.times(b).div(10_000));
  const unit = dec('0.000001');
  return largestRemainder(exact, unit, q6(amount));
}

/**
 * Interpreta un monto escrito por una persona en cualquier formato regional:
 * "1442.17", "1442,17", "1.442,17", "1,442.17", "USD 1.442,17". Devuelve "1442.17" o null.
 * El último separador seguido de 1–2 dígitos es el decimal; los demás son de miles.
 */
export function parseMoneyInput(input: string): string | null {
  const s = input.replace(/[^\d.,-]/g, '');
  if (!/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const m = body.match(/^(.*?)[.,](\d{1,2})$/);
  const intRaw = m ? m[1]! : body;
  // Separadores de miles: grupos de exactamente 3 dígitos, con un solo tipo de separador.
  if (/[.,]/.test(intRaw)) {
    const seps = new Set(intRaw.replace(/\d/g, ''));
    const groups = intRaw.split(/[.,]/);
    if (seps.size > 1 || !/^\d{1,3}$/.test(groups[0]!) || groups.slice(1).some((g) => !/^\d{3}$/.test(g))) return null;
  }
  const intPart = intRaw.replace(/[.,]/g, '');
  const dec = m ? m[2]! : '';
  if (!/^\d+$/.test(intPart || '0')) return null;
  const n = `${neg ? '-' : ''}${intPart || '0'}${dec ? `.${dec.padEnd(2, '0')}` : ''}`;
  return /^-?\d{1,12}(\.\d{2})?$/.test(n) ? n : null;
}

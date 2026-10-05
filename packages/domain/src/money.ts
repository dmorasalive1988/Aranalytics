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

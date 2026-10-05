import { BPS_TOTAL } from './bps';
import { D, dec, largestRemainder, q6, splitByBps, type Dec } from './money';

export type DistributionStatus = 'payable' | 'held_dispute' | 'suspense';
export type SuspenseReason = 'unmatched' | 'not_administered' | 'no_signed_split';

export interface LineForDistribution {
  lineId: string;
  /** Neto pagado por la línea, en su moneda (puede ser negativo: ajustes y reversos). */
  net: string;
  currency: string;
  /** Tasa a la moneda de los statements (USD). 1 si ya está en USD. */
  fxRate: string;
  /** null si la línea no casó con ninguna obra. */
  shares: ShareForDistribution[] | null;
  /** Obra en disputa: se calcula pero se retiene. */
  held: boolean;
}

export interface ShareForDistribution {
  shareId: string;
  writerUserId: string | null;
  bps: number;
  administered: boolean;
}

export interface WriterTerms {
  commissionBps: number;
  withholdingBps: number;
}

export interface DistributionRow {
  lineId: string;
  shareId: string | null;
  writerUserId: string | null;
  shareBps: number;
  status: DistributionStatus;
  suspenseReason: SuspenseReason | null;
  gross: Dec; // moneda de la línea
  grossUsd: Dec;
  commissionBps: number;
  commission: Dec;
  withholdingBps: number;
  withholding: Dec;
  net: Dec;
}

/**
 * Reparte una línea normalizada entre las participaciones del split vigente.
 * - Socio administrado: comisión del plan y retención fiscal (sobre lo que queda tras la comisión).
 * - Obra en disputa: se calcula igual, pero queda retenida.
 * - Coautor no socio o línea sin match: todo a suspenso, sin comisión.
 * Los 6 decimales se reparten por mayor residuo: la suma de las partes es exactamente la línea.
 */
export function distributeLine(line: LineForDistribution, terms: (writerUserId: string) => WriterTerms): DistributionRow[] {
  const gross = q6(dec(line.net));
  const grossUsd = q6(gross.times(line.fxRate));
  const base = { lineId: line.lineId, commissionBps: 0, commission: dec(0), withholdingBps: 0, withholding: dec(0) };

  if (!line.shares || line.shares.length === 0) {
    return [{ ...base, shareId: null, writerUserId: null, shareBps: BPS_TOTAL, status: 'suspense', suspenseReason: line.shares ? 'no_signed_split' : 'unmatched', gross, grossUsd, net: grossUsd }];
  }
  const bps = line.shares.map((s) => s.bps);
  if (bps.reduce((a, b) => a + b, 0) !== BPS_TOTAL) throw new Error(`split que no suma 100 % en la línea ${line.lineId}`);
  const parts = splitByBps(gross, bps);
  const partsUsd = splitByBps(grossUsd, bps);

  return line.shares.map((s, i) => {
    const g = parts[i]!;
    const gu = partsUsd[i]!;
    if (!s.administered || !s.writerUserId) {
      return { ...base, shareId: s.shareId, writerUserId: s.writerUserId, shareBps: s.bps, status: 'suspense', suspenseReason: 'not_administered', gross: g, grossUsd: gu, net: gu };
    }
    const t = terms(s.writerUserId);
    const commission = q6(gu.times(t.commissionBps).div(BPS_TOTAL));
    const withholding = q6(gu.minus(commission).times(t.withholdingBps).div(BPS_TOTAL));
    return {
      lineId: line.lineId,
      shareId: s.shareId,
      writerUserId: s.writerUserId,
      shareBps: s.bps,
      status: line.held ? 'held_dispute' : 'payable',
      suspenseReason: null,
      gross: g,
      grossUsd: gu,
      commissionBps: t.commissionBps,
      commission,
      withholdingBps: t.withholdingBps,
      withholding,
      net: gu.minus(commission).minus(withholding),
    };
  });
}

export interface WriterCents {
  writerUserId: string;
  netCents: number;
  commissionCents: number;
  withholdingCents: number;
  heldCents: number;
  /** Bruto = neto + comisión + retención (identidad exacta en centavos). */
  grossCents: number;
}

export interface Reconciliation {
  currency: 'USD';
  receivedCents: number;
  controlTotalCents: number;
  parsedTotalCents: number;
  writersNetCents: number;
  commissionCents: number;
  withholdingCents: number;
  recoupmentCents: number;
  heldCents: number;
  suspenseCents: number;
  roundingCents: number;
  differenceCents: number;
  balanced: boolean;
  writers: WriterCents[];
}

/**
 * Pasa todas las distribuciones a centavos UNA sola vez, con mayor residuo sobre el vector completo
 * (neto, comisión, retención y retenido de cada autor, más el suspenso), y verifica la ecuación:
 *
 *   recibido = Σ neto autores + Σ comisión + Σ retenciones + Σ recuperaciones + Σ retenido + Σ suspenso + redondeo
 *
 * y además que el total parseado coincida con el total de control del archivo. Si cualquiera no
 * cuadra al centavo, `balanced` es false y la publicación se bloquea.
 */
export function reconcile(args: { rows: DistributionRow[]; receivedCents: number; controlTotalUsd: string; parsedTotalUsd: string }): Reconciliation {
  const byWriter = new Map<string, { net: Dec; commission: Dec; withholding: Dec; held: Dec }>();
  let suspense = dec(0);
  for (const r of args.rows) {
    if (r.status === 'suspense' || !r.writerUserId) {
      suspense = suspense.plus(r.grossUsd);
      continue;
    }
    const w = byWriter.get(r.writerUserId) ?? { net: dec(0), commission: dec(0), withholding: dec(0), held: dec(0) };
    if (r.status === 'held_dispute') w.held = w.held.plus(r.grossUsd);
    else {
      w.net = w.net.plus(r.net);
      w.commission = w.commission.plus(r.commission);
      w.withholding = w.withholding.plus(r.withholding);
    }
    byWriter.set(r.writerUserId, w);
  }
  const writers = [...byWriter.keys()].sort();
  const vector: Dec[] = [];
  for (const id of writers) {
    const w = byWriter.get(id)!;
    vector.push(w.net, w.commission, w.withholding, w.held);
  }
  vector.push(suspense);
  const exactTotal = vector.reduce((a, b) => a.plus(b), dec(0));
  const totalCents = exactTotal.times(100).toDecimalPlaces(0, D.ROUND_HALF_UP);
  const allocated = largestRemainder(vector.map((v) => v.times(100)), dec(1), totalCents).map((v) => v.toNumber());

  const writerCents: WriterCents[] = writers.map((id, i) => {
    const [net, commission, withholding, held] = allocated.slice(i * 4, i * 4 + 4) as [number, number, number, number];
    return { writerUserId: id, netCents: net, commissionCents: commission, withholdingCents: withholding, heldCents: held, grossCents: net + commission + withholding };
  });
  const suspenseCents = allocated[allocated.length - 1]!;
  const sum = (k: keyof WriterCents) => writerCents.reduce((a, w) => a + (w[k] as number), 0);
  const writersNet = sum('netCents');
  const commission = sum('commissionCents');
  const withholding = sum('withholdingCents');
  const held = sum('heldCents');
  const recoupment = 0;
  const distributed = writersNet + commission + withholding + recoupment + held + suspenseCents;
  const rounding = totalCents.toNumber() - distributed; // siempre 0 con mayor residuo; se registra explícito
  const controlTotalCents = dec(args.controlTotalUsd).times(100).toDecimalPlaces(0, D.ROUND_HALF_UP).toNumber();
  const parsedTotalCents = dec(args.parsedTotalUsd).times(100).toDecimalPlaces(0, D.ROUND_HALF_UP).toNumber();
  const difference = args.receivedCents - (distributed + rounding);
  return {
    currency: 'USD',
    receivedCents: args.receivedCents,
    controlTotalCents,
    parsedTotalCents,
    writersNetCents: writersNet,
    commissionCents: commission,
    withholdingCents: withholding,
    recoupmentCents: recoupment,
    heldCents: held,
    suspenseCents,
    roundingCents: rounding,
    differenceCents: difference,
    balanced: difference === 0 && parsedTotalCents === controlTotalCents,
    writers: writerCents,
  };
}

/** Split aplicable a una línea: la versión firmada vigente al último día del período de explotación. */
export function applicableVersion<V extends { version: number; effectiveFrom: string | null }>(versions: V[], exploitationEnd: string | null): V | null {
  const signed = versions.filter((v) => v.effectiveFrom).sort((a, b) => b.version - a.version);
  if (!signed.length) return null;
  if (!exploitationEnd) return signed[0]!;
  return signed.find((v) => v.effectiveFrom! <= exploitationEnd) ?? signed[signed.length - 1]!;
}

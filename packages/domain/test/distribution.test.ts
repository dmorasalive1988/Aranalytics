import { describe, expect, it } from 'vitest';
import { applicableVersion, dec, distributeLine, largestRemainder, reconcile, splitByBps, type DistributionRow, type LineForDistribution } from '../src';

const terms = (c: Record<string, [number, number]>) => (id: string) => ({ commissionBps: c[id]![0], withholdingBps: c[id]![1] });
const s = (rows: DistributionRow[]) => rows.map((r) => ({ w: r.writerUserId, st: r.status, gross: r.grossUsd.toFixed(6), com: r.commission.toFixed(6), wh: r.withholding.toFixed(6), net: r.net.toFixed(6) }));

describe('mayor residuo', () => {
  it('reparte un tercio sin perder centavos', () => {
    const r = largestRemainder([dec('33.333333'), dec('33.333333'), dec('33.333334')].map((v) => v.times(100)), dec(1), dec(10000));
    expect(r.map((x) => x.toNumber())).toEqual([3333, 3333, 3334]);
  });
  it('funciona con negativos', () => {
    const r = largestRemainder([dec('-10.005'), dec('5.005'), dec('0.010')].map((v) => v.times(100)), dec(1), dec(-499));
    expect(r.reduce((a, b) => a + b.toNumber(), 0)).toBe(-499);
  });
  it('split por puntos básicos a 6 decimales suma exacto', () => {
    const parts = splitByBps(dec('10.000001'), [3333, 3333, 3334]);
    expect(parts.reduce((a, b) => a.plus(b), dec(0)).toFixed(6)).toBe('10.000001');
  });
});

describe('distribución de una línea (ejemplo del documento de modelo de datos)', () => {
  const line: LineForDistribution = {
    lineId: 'L1', net: '100', currency: 'USD', fxRate: '1', held: false,
    shares: [
      { shareId: 'a', writerUserId: 'ana', bps: 5000, administered: true },
      { shareId: 'b', writerUserId: 'bruno', bps: 3000, administered: true },
      { shareId: 'c', writerUserId: null, bps: 2000, administered: false },
    ],
  };
  const rows = distributeLine(line, terms({ ana: [1500, 1000], bruno: [2000, 1000] }));

  it('Ana Pro 15 % y Bruno Socio 20 %, retención 10 % tras la comisión, Carla a suspenso', () => {
    expect(s(rows)).toEqual([
      { w: 'ana', st: 'payable', gross: '50.000000', com: '7.500000', wh: '4.250000', net: '38.250000' },
      { w: 'bruno', st: 'payable', gross: '30.000000', com: '6.000000', wh: '2.400000', net: '21.600000' },
      { w: null, st: 'suspense', gross: '20.000000', com: '0.000000', wh: '0.000000', net: '20.000000' },
    ]);
  });

  it('cuadra al centavo y queda balanceado', () => {
    const r = reconcile({ rows, receivedCents: 10000, controlTotalUsd: '100', parsedTotalUsd: '100' });
    expect(r).toMatchObject({ writersNetCents: 5985, commissionCents: 1350, withholdingCents: 665, suspenseCents: 2000, heldCents: 0, roundingCents: 0, differenceCents: 0, balanced: true });
    expect(r.writers.find((w) => w.writerUserId === 'ana')).toMatchObject({ netCents: 3825, grossCents: 5000 });
  });

  it('un centavo de diferencia con lo recibido bloquea la publicación', () => {
    const r = reconcile({ rows, receivedCents: 9999, controlTotalUsd: '100', parsedTotalUsd: '100' });
    expect(r.balanced).toBe(false);
    expect(r.differenceCents).toBe(-1);
  });

  it('un centavo de diferencia con el total de control del archivo también bloquea', () => {
    expect(reconcile({ rows, receivedCents: 10000, controlTotalUsd: '100.01', parsedTotalUsd: '100' }).balanced).toBe(false);
  });
});

describe('casos borde', () => {
  it('obra en disputa: se calcula pero todo queda retenido', () => {
    const rows = distributeLine({ lineId: 'L', net: '10', currency: 'USD', fxRate: '1', held: true, shares: [{ shareId: 'a', writerUserId: 'ana', bps: 10000, administered: true }] }, terms({ ana: [2000, 0] }));
    const r = reconcile({ rows, receivedCents: 1000, controlTotalUsd: '10', parsedTotalUsd: '10' });
    expect(r).toMatchObject({ heldCents: 1000, writersNetCents: 0, commissionCents: 0, balanced: true });
  });

  it('línea sin match: todo a suspenso, sin comisión', () => {
    const rows = distributeLine({ lineId: 'L', net: '7.25', currency: 'USD', fxRate: '1', held: false, shares: null }, terms({}));
    expect(rows[0]).toMatchObject({ status: 'suspense', suspenseReason: 'unmatched' });
  });

  it('línea negativa (reverso) descuenta del autor y puede dejar saldo negativo', () => {
    const t = terms({ ana: [2000, 0] });
    const rows = [
      ...distributeLine({ lineId: 'L1', net: '5', currency: 'USD', fxRate: '1', held: false, shares: [{ shareId: 'a', writerUserId: 'ana', bps: 10000, administered: true }] }, t),
      ...distributeLine({ lineId: 'L2', net: '-12.5', currency: 'USD', fxRate: '1', held: false, shares: [{ shareId: 'a', writerUserId: 'ana', bps: 10000, administered: true }] }, t),
    ];
    const r = reconcile({ rows, receivedCents: -750, controlTotalUsd: '-7.5', parsedTotalUsd: '-7.5' });
    expect(r).toMatchObject({ writersNetCents: -600, commissionCents: -150, balanced: true });
  });

  it('moneda extranjera: conversión con la tasa documentada', () => {
    const rows = distributeLine({ lineId: 'L', net: '10', currency: 'EUR', fxRate: '1.0833', held: false, shares: [{ shareId: 'a', writerUserId: 'ana', bps: 10000, administered: true }] }, terms({ ana: [1500, 0] }));
    expect(rows[0]!.gross.toFixed(2)).toBe('10.00');
    expect(rows[0]!.grossUsd.toFixed(4)).toBe('10.8330');
  });

  it('muchas líneas fraccionarias: la suma en centavos es exacta', () => {
    const t = terms({ a: [1500, 0], b: [2000, 1100], c: [2000, 0] });
    const rows: DistributionRow[] = [];
    let total = dec(0);
    for (let i = 0; i < 500; i++) {
      const net = dec('0.003317').times(i + 1);
      total = total.plus(net);
      rows.push(...distributeLine({ lineId: `L${i}`, net: net.toFixed(6), currency: 'USD', fxRate: '1', held: i % 50 === 0, shares: [
        { shareId: 'x', writerUserId: 'a', bps: 3333, administered: true },
        { shareId: 'y', writerUserId: 'b', bps: 3333, administered: true },
        { shareId: 'z', writerUserId: 'c', bps: 3334, administered: true },
      ] }, t));
    }
    const cents = total.times(100).toDecimalPlaces(0).toNumber();
    const r = reconcile({ rows, receivedCents: cents, controlTotalUsd: total.toFixed(6), parsedTotalUsd: total.toFixed(6) });
    expect(r.balanced).toBe(true);
    for (const w of r.writers) expect(w.grossCents).toBe(w.netCents + w.commissionCents + w.withholdingCents);
  });

  it('el cálculo es reproducible: mismo insumo, mismo resultado', () => {
    const line: LineForDistribution = { lineId: 'L', net: '123.456789', currency: 'USD', fxRate: '1', held: false, shares: [{ shareId: 'a', writerUserId: 'a', bps: 7000, administered: true }, { shareId: 'b', writerUserId: 'b', bps: 3000, administered: true }] };
    const t = terms({ a: [1500, 500], b: [2000, 0] });
    expect(s(distributeLine(line, t))).toEqual(s(distributeLine(line, t)));
  });
});

describe('versión de split aplicable', () => {
  const versions = [{ version: 1, effectiveFrom: '2026-01-10' }, { version: 2, effectiveFrom: '2026-05-01' }, { version: 3, effectiveFrom: null }];
  it('usa la firmada vigente al último día del período de explotación', () => {
    expect(applicableVersion(versions, '2026-03-31')!.version).toBe(1);
    expect(applicableVersion(versions, '2026-06-30')!.version).toBe(2);
  });
  it('si la obra se firmó después del período, usa la primera firmada', () => {
    expect(applicableVersion(versions, '2025-12-31')!.version).toBe(1);
  });
  it('sin versiones firmadas no hay split', () => {
    expect(applicableVersion([{ version: 1, effectiveFrom: null }], '2026-01-01')).toBeNull();
  });
});

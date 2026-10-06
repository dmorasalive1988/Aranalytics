import { describe, expect, it } from 'vitest';
import { analytics } from '../src';
import type { IncomeRow } from '../src/analytics';

const row = (p: Partial<IncomeRow>): IncomeRow => ({
  period: '2025-Q4', payDate: '2026-02-15', workId: 'w1', title: 'Luna', source: 'SPOTIFY', incomeType: 'mechanical', territory: 'US',
  exploitationEnd: '2025-09-30', grossCents: 0, commissionCents: 0, withholdingCents: 0, netCents: 0, ...p,
});

const rows: IncomeRow[] = [
  row({ period: '2025-Q4', payDate: '2026-02-15', source: 'SPOTIFY', territory: 'US', netCents: 10_000 }),
  row({ period: '2025-Q4', payDate: '2026-02-15', source: 'SAYCO', incomeType: 'performance', territory: 'CO', netCents: 30_000 }),
  row({ period: '2026-Q1', payDate: '2026-05-15', source: 'SPOTIFY', territory: 'US', netCents: 15_000, exploitationEnd: '2025-12-31' }),
  row({ period: '2026-Q1', payDate: '2026-05-15', source: 'SAYCO', incomeType: 'performance', territory: 'CO', netCents: 20_000, exploitationEnd: '2025-12-31' }),
  row({ period: '2026-Q1', payDate: '2026-05-15', workId: 'w2', title: 'Marea', source: 'YOUTUBE', incomeType: 'youtube_ugc', territory: 'MX', netCents: 5_000, exploitationEnd: '2025-12-31' }),
];

describe('analítica Pro', () => {
  it('todos los períodos: totales, participación por fuente y país, y variación del último período', () => {
    const s = analytics.summarizeIncome(rows);
    expect(s.totalCents).toBe(80_000);
    expect(s.lastCents).toBe(40_000);
    expect(s.prevTotalCents).toBe(40_000);
    expect(s.bySource.map((x) => [x.key, x.cents])).toEqual([['SAYCO', 50_000], ['SPOTIFY', 25_000], ['YOUTUBE', 5_000]]);
    expect(s.bySource[0]!.share).toBeCloseTo(0.625);
    const spotify = s.bySource.find((x) => x.key === 'SPOTIFY')!;
    expect([spotify.lastCents, spotify.prevCents]).toEqual([15_000, 10_000]);
    expect(s.byCountry[0]!.key).toBe('CO');
    expect(s.newCountries).toEqual(['MX']);
    expect(s.newSources).toEqual(['YOUTUBE']);
    expect(s.periods.map((p) => p.cents)).toEqual([40_000, 40_000]);
    expect(s.periods[1]!.byType.youtube_ugc).toBe(5_000);
    expect(s.matrix.cells['SPOTIFY|US']).toBe(25_000);
  });

  it('un período: compara con el anterior y mide el tiempo hasta el pago', () => {
    const s = analytics.summarizeIncome(rows, '2026-Q1');
    expect(s.selected).toEqual(['2026-Q1']);
    expect(s.totalCents).toBe(40_000);
    expect(s.prevTotalCents).toBe(40_000);
    expect(s.byWork.map((w) => [w.key, w.cents, w.topSource])).toEqual([['Luna', 35_000, 'SAYCO'], ['Marea', 5_000, 'YOUTUBE']]);
    expect(s.byWork[0]!.trend).toEqual([40_000, 35_000]);
    expect(s.avgLagDays).toBe(135); // 2025-12-31 → 2026-05-15
  });

  it('nombres de fuente legibles y CSV', () => {
    expect(analytics.sourceLabel('APPLE MUSIC')).toBe('Apple Music');
    expect(analytics.sourceLabel('YOUTUBE')).toBe('YouTube');
    expect(analytics.sourceLabel('SAYCO')).toBe('SAYCO');
    const csv = analytics.incomeCsv([row({ title: 'Luna, la de "Medellín"', netCents: 1234 })]);
    expect(csv.split('\n')[1]).toBe('2025-Q4,2026-02-15,"Luna, la de ""Medellín""",Spotify,mechanical,US,0.00,0.00,0.00,12.34');
  });
});

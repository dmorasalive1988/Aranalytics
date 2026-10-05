import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { connectorFor, detectConnector, parseCsv } from '../src';

const fixture = (n: string) => readFileSync(join(__dirname, '../../../fixtures/statements', n));

describe('conector del administrador asociado', () => {
  it('detecta el formato por sus columnas', () => {
    expect(detectConnector(fixture('2026-Q2.csv').toString())?.provider).toBe('primary_administrator');
    expect(detectConnector('a,b,c\n1,2,3')).toBeNull();
  });

  it('normaliza el archivo ficticio de 2026-Q2', () => {
    const p = connectorFor('primary_administrator').parse(fixture('2026-Q2.csv'));
    expect(p.errors).toEqual([]);
    expect(p.lines).toHaveLength(12);
    expect(p.controlTotals).toEqual({ USD: '1398.77', EUR: '40.00' });
    const first = p.lines[0]!;
    expect(first).toMatchObject({ lineNo: 2, providerWorkCode: 'PLM-CO-000101', source: 'SAYCO', incomeType: 'performance', territory: 'CO', currency: 'USD', net: '412.50', exploitationEnd: '2026-03-31', payPeriod: '2026-Q2' });
    expect(p.lines.find((l) => l.iswc === 'T-123.456.789-4')?.workTitle).toBe('MIDNIGHT IN WYNWOOD');
    expect(p.lines.find((l) => l.writerIpi)?.writerIpi).toBe('00712345679');
    const reversal = p.lines.at(-1)!;
    expect(reversal).toMatchObject({ net: '-15.00', isAdjustment: true, adjustsPeriod: '2026-Q1' });
    // la suma de las líneas coincide con los totales de control
    const usd = p.lines.filter((l) => l.currency === 'USD').reduce((a, l) => a + Math.round(Number(l.net) * 100), 0);
    expect(usd).toBe(139877);
  });

  it('reporta errores por línea sin detener el resto', () => {
    const bad = Buffer.from(fixture('2026-Q1.csv').toString().replace('350.00', '35O.00').replace('2025-10-01,2025-12-31,USD,105.83', '2025-13-01,2025-12-31,USD,105.83'));
    const p = connectorFor('primary_administrator').parse(bad);
    expect(p.lines).toHaveLength(1);
    expect(p.errors.map((e) => e.lineNo)).toEqual([2, 3]);
  });

  it('CSV con comillas, comas y punto y coma', () => {
    expect(parseCsv('a;b\n"x;y";"di ""hola"""\n')).toEqual([['a', 'b'], ['x;y', 'di "hola"']]);
    expect(parseCsv('a,b\r\n"1,5",2\r\n')).toEqual([['a', 'b'], ['1,5', '2']]);
  });
});

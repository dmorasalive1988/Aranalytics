import { describe, expect, it } from 'vitest';
import { isMinor, isValidIsrc, isValidIswc, normalizeIsrc, normalizeIswc, isValidIpi, canonicalSplitSheet } from '../src';

describe('identificadores', () => {
  it('ISRC', () => {
    expect(isValidIsrc('CO-A1B-26-00001')).toBe(true);
    expect(normalizeIsrc('co-a1b-26-00001')).toBe('COA1B2600001');
    expect(isValidIsrc('CO-A1B-26-0001')).toBe(false);
  });
  it('ISWC con dígito verificador', () => {
    expect(isValidIswc('T-034.524.680-1')).toBe(true);
    expect(isValidIswc('T0345246801')).toBe(true);
    expect(isValidIswc('T-034.524.680-2')).toBe(false);
    expect(normalizeIswc('T0345246801')).toBe('T-034.524.680-1');
  });
  it('IPI', () => {
    expect(isValidIpi('00052210040')).toBe(true);
    expect(isValidIpi('1234')).toBe(false);
  });
});

describe('menores de edad', () => {
  it('cumple 18 el día de su cumpleaños', () => {
    expect(isMinor('2008-10-06', 'CO', new Date('2026-10-05T12:00:00Z'))).toBe(true);
    expect(isMinor('2008-10-05', 'CO', new Date('2026-10-05T12:00:00Z'))).toBe(false);
  });
});

describe('hoja de splits canónica', () => {
  it('es determinista sin importar el orden de las partes', () => {
    const base = { workId: 'w1', title: 'Luna', altTitles: [], language: 'es', version: 1, createdAt: '2026-10-05T00:00:00.000Z' };
    const a = { name: 'Ana', email: 'ana@x.co', ipi: null, society: 'SAYCO', role: 'composer' as const, bps: 5000, administered: true };
    const b = { name: 'Bruno', email: 'BRUNO@x.co', ipi: null, society: null, role: 'lyricist' as const, bps: 5000, administered: false };
    expect(canonicalSplitSheet({ ...base, parties: [a, b] })).toBe(canonicalSplitSheet({ ...base, parties: [b, a] }));
    expect(canonicalSplitSheet({ ...base, parties: [a, b] })).toContain('<bruno@x.co>');
  });
});

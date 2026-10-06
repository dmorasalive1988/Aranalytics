import { describe, expect, it } from 'vitest';
import { parseSyncQuery, quote } from '../src';

describe('cotizador de sync', () => {
  it('ajusta la tarifa base por plazo y one-stop, redondeada a USD 50', () => {
    const base = { minCents: 50000, maxCents: 150000 };
    expect(quote(base, 12, false)).toEqual({ minCents: 50000, maxCents: 150000 });
    expect(quote(base, 24, false)).toEqual({ minCents: 80000, maxCents: 240000 });
    expect(quote(base, 12, true)).toEqual({ minCents: 90000, maxCents: 270000 });
    expect(() => quote(base, 7, false)).toThrow('TERM_INVALID');
  });
});

describe('búsqueda en lenguaje natural (respaldo sin API)', () => {
  it('extrae filtros duros en español', () => {
    const f = parseSyncQuery('Reggaetón alegre instrumental, 90-100 BPM, en español y one-stop para un comercial de verano');
    expect(f).toMatchObject({ genres: ['reggaeton'], moods: ['happy'], instrumental: true, vocals: 'none', bpmMin: 90, bpmMax: 100, languages: ['es'], oneStop: true });
    expect(f.text).toContain('comercial');
    expect(f.text).toContain('verano');
  });
  it('entiende inglés y portugués', () => {
    expect(parseSyncQuery('romantic latin pop with female vocals around 95 bpm')).toMatchObject({ genres: ['latin pop'], moods: ['romantic'], vocals: 'female', bpmMin: 90, bpmMax: 100 });
    expect(parseSyncQuery('forró nostálgico em português')).toMatchObject({ genres: ['forro'], moods: ['nostalgic'], languages: ['pt'] });
  });
});

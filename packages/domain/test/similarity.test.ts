import { describe, expect, it } from 'vitest';
import { detectConflicts, normalizeTitle, titleSimilarity } from '../src';

describe('similitud de títulos', () => {
  it('normaliza tildes, mayúsculas y colaboraciones', () => {
    expect(normalizeTitle('Canción de Amor (feat. J Balvin)')).toBe('cancion de amor');
    expect(normalizeTitle('CANCIÓN DE AMOR ft. Karol G')).toBe('cancion de amor');
    expect(normalizeTitle('Luna — Versión acústica')).toBe('luna version acustica');
  });
  it('títulos iguales salvo formato son 1', () => {
    expect(titleSimilarity('Canción de amor', 'CANCION DE AMOR (feat. X)')).toBe(1);
    expect(titleSimilarity('Luna llena', 'Sol de mediodía')).toBeLessThan(0.2);
  });
});

describe('detección de conflictos', () => {
  const mine = { ownerId: 'yo', title: 'Luna de Barranquilla', isrcs: ['COA1B2600001'], iswc: null, audioSha256: 'abc' };
  it('alerta por ISRC compartido con título parecido, ignora mis propias obras', () => {
    const r = detectConflicts(mine, [
      { workId: 'w1', ownerId: 'otro', title: 'LUNA DE BARRANQUILLA (Remix)', isrcs: ['COA1B2600001'], iswc: null, audioSha256: null },
      { workId: 'w2', ownerId: 'yo', title: 'Luna de Barranquilla', isrcs: [], iswc: null, audioSha256: 'abc' },
      { workId: 'w3', ownerId: 'otro', title: 'Otra canción', isrcs: [], iswc: null, audioSha256: null },
    ]);
    expect(r).toEqual([{ workId: 'w1', reason: 'title_isrc', score: 1 }]);
  });
  it('mismo audio de otro usuario es conflicto aunque cambie el título', () => {
    const r = detectConflicts(mine, [{ workId: 'w4', ownerId: 'otro', title: 'Nada que ver', isrcs: [], iswc: null, audioSha256: 'abc' }]);
    expect(r[0]?.reason).toBe('audio_hash');
  });
});

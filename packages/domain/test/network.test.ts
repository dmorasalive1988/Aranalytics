import { describe, expect, it } from 'vitest';
import { applicationTimer, preAgreedShares, remainingQuota, rolesFor, validateRequest } from '../src';

const H = 3_600_000;

describe('red: split pre-acordado', () => {
  it('quien se postula recibe lo ofrecido; quien publica, el resto', () => {
    expect(preAgreedShares('beat_seeks_topliner', 'o', 'a', 4000)).toEqual([
      { userId: 'o', role: 'composer', bps: 6000 },
      { userId: 'a', role: 'composer_lyricist', bps: 4000 },
    ]);
    expect(rolesFor('seeks_producer')).toEqual({ owner: 'composer_lyricist', applicant: 'composer' });
    expect(() => preAgreedShares('session_or_camp', 'o', 'a', 10000)).toThrow('SHARE_INVALID');
  });
});

describe('red: cupo diario', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  it('cuenta solo las últimas 24 h y dice cuándo se libera el próximo cupo', () => {
    const recent = [new Date(now.getTime() - 2 * H), new Date(now.getTime() - 5 * H), new Date(now.getTime() - 23 * H), new Date(now.getTime() - 30 * H)];
    expect(remainingQuota(10, recent, now)).toMatchObject({ used: 3, remaining: 7, nextSlotAt: null });
    const full = remainingQuota(3, recent, now);
    expect(full.remaining).toBe(0);
    expect(full.nextSlotAt).toEqual(new Date(now.getTime() + H));
  });
});

describe('red: tiempos de una postulación', () => {
  const created = new Date('2026-10-01T00:00:00Z');
  const expires = new Date('2026-10-08T00:00:00Z');
  it('recuerda a las 72 h una sola vez y vence a los 7 días', () => {
    expect(applicationTimer(created, null, expires, new Date(created.getTime() + 71 * H))).toBe('wait');
    expect(applicationTimer(created, null, expires, new Date(created.getTime() + 72 * H))).toBe('remind');
    expect(applicationTimer(created, new Date(created.getTime() + 72 * H), expires, new Date(created.getTime() + 100 * H))).toBe('wait');
    expect(applicationTimer(created, null, expires, expires)).toBe('expire');
  });
});

describe('red: validación de solicitudes', () => {
  const ok = { type: 'beat_seeks_topliner', title: 'Beat de dembow', description: 'Busco topliner para un dembow a 100 BPM.', genre: 'Dembow', languages: ['es'], bpm: 100, city: null, modality: 'remote', offeredShareBps: 5000 };
  it('acepta una solicitud completa y rechaza la presencial sin ciudad', () => {
    expect(() => validateRequest(ok)).not.toThrow();
    expect(() => validateRequest({ ...ok, modality: 'in_person' })).toThrow('CITY_REQUIRED');
    expect(() => validateRequest({ ...ok, offeredShareBps: 9500 })).toThrow('OFFERED_SHARE_INVALID');
    expect(() => validateRequest({ ...ok, bpm: 20 })).toThrow('BPM_INVALID');
    expect(() => validateRequest({ ...ok, type: 'otro' })).toThrow('REQUEST_TYPE_INVALID');
  });
});

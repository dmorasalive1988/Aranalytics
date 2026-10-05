import { describe, expect, it } from 'vitest';
import { parsePercentToBps, formatBps, bpsToInput, validateSplit, versionStatusFromShares, splitsDiffer, type DraftShare } from '../src';

const member = (userId: string, bps: number): DraftShare => ({ party: { kind: 'member', userId }, role: 'composer_lyricist', bps });
const ext = (email: string, bps: number, name = 'Coautor'): DraftShare => ({ party: { kind: 'external', name, email }, role: 'composer', bps });

describe('porcentajes', () => {
  it('acepta coma o punto, hasta dos decimales', () => {
    expect(parsePercentToBps('12,5')).toBe(1250);
    expect(parsePercentToBps('12.50')).toBe(1250);
    expect(parsePercentToBps('33 %')).toBe(3300);
    expect(parsePercentToBps('100')).toBe(10000);
    expect(parsePercentToBps('0,01')).toBe(1);
  });
  it('rechaza valores imposibles', () => {
    for (const v of ['', 'abc', '100,01', '101', '-5', '12,345', '1e2']) expect(parsePercentToBps(v)).toBeNull();
  });
  it('formatea según el idioma', () => {
    expect(formatBps(1250, 'es-CO')).toMatch(/12,5\s?%/);
    expect(formatBps(1250, 'en-US')).toBe('12.5%');
    expect(bpsToInput(3333, 'pt-BR')).toBe('33,33');
    expect(bpsToInput(5000, 'en')).toBe('50');
  });
});

describe('validación de splits (criterio 2)', () => {
  const four = [member('ana', 2500), member('bruno', 2500), ext('carla@x.co', 2500), ext('dario@x.co', 2500)];

  it('4 coautores que suman 100 % se pueden enviar', () => {
    const v = validateSplit(four, 'ana');
    expect(v.ok).toBe(true);
    expect(v.totalBps).toBe(10000);
  });

  it('un centésimo de diferencia bloquea el envío', () => {
    const almost = [...four.slice(0, 3), ext('dario@x.co', 2499)];
    const v = validateSplit(almost, 'ana');
    expect(v.ok).toBe(false);
    expect(v.remainingBps).toBe(1);
    expect(v.issues).toContainEqual({ code: 'TOTAL_NOT_100' });
  });

  it('pasarse de 100 % también bloquea', () => {
    const v = validateSplit([...four.slice(0, 3), ext('dario@x.co', 2600)], 'ana');
    expect(v.ok).toBe(false);
    expect(v.remainingBps).toBe(-100);
  });

  it('detecta duplicados, correos inválidos, ceros y creador ausente', () => {
    const v = validateSplit([member('ana', 5000), ext('CARLA@x.co', 2500), ext('carla@x.co', 0), ext('malo', 2500, '')], 'yo');
    const codes = v.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['DUPLICATE_PARTY', 'SHARE_NOT_POSITIVE', 'EXTERNAL_EMAIL_INVALID', 'EXTERNAL_NAME_REQUIRED', 'CREATOR_MISSING']));
  });

  it('el estado de la versión sale de las firmas', () => {
    expect(versionStatusFromShares(['signed', 'signed', 'pending', 'signed'])).toBe('pending_signatures');
    expect(versionStatusFromShares(['signed', 'signed', 'signed', 'signed'])).toBe('signed');
    expect(versionStatusFromShares(['signed', 'rejected', 'pending'])).toBe('rejected');
  });

  it('cualquier cambio de porcentaje, rol o persona exige nueva firma', () => {
    expect(splitsDiffer(four, [...four].reverse())).toBe(false);
    expect(splitsDiffer(four, [...four.slice(0, 3), ext('otra@x.co', 2500)])).toBe(true);
    expect(splitsDiffer(four, [{ ...four[0]!, role: 'lyricist' }, ...four.slice(1)])).toBe(true);
  });
});

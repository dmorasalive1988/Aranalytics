import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from '../src';

describe('estados de obra', () => {
  it('no pasa a registro sin firmas', () => {
    expect(canTransition('draft', 'sent_to_publisher')).toBe(false);
    expect(canTransition('awaiting_signatures', 'sent_to_publisher')).toBe(false);
    expect(canTransition('awaiting_signatures', 'splits_signed')).toBe(true);
    expect(canTransition('splits_signed', 'sent_to_publisher')).toBe(true);
    expect(canTransition('sent_to_publisher', 'registered')).toBe(true);
  });
  it('cualquier estado con firmas en curso puede pasar a disputa', () => {
    for (const s of ['awaiting_signatures', 'splits_signed', 'sent_to_publisher', 'registered'] as const) {
      expect(canTransition(s, 'disputed')).toBe(true);
    }
    expect(() => assertTransition('draft', 'registered')).toThrowError('WORK_INVALID_TRANSITION');
  });
});

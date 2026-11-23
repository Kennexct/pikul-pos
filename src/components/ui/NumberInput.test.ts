import { describe, expect, it } from 'vitest';
import { parseNumber } from './NumberInput';

describe('parseNumber', () => {
  it('reads empty as the minimum and accepts a comma decimal', () => {
    expect(parseNumber('', 0, 100, false)).toBe(0);
    expect(parseNumber('11,5', 0, 100, false)).toBe(11.5);
    expect(parseNumber('11.5', 0, 100, false)).toBe(11.5);
  });
  it('clamps and rounds whole-number fields', () => {
    expect(parseNumber('250', 0, 100, false)).toBe(100);
    expect(parseNumber('2,6', 1, 99, true)).toBe(3);
    expect(parseNumber('0', 1, 99, true)).toBe(1);
  });
});

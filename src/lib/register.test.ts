import { describe, expect, it } from 'vitest';
import { DENOMINATIONS, sumDenominations } from './denominations';
import { registerStatus } from './register';

describe('registerStatus', () => {
  it('asks to open when nothing happened today', () => {
    expect(registerStatus({ hasOpening: false, hasCountedSale: false, hasClosing: false })).toBe('not_open');
  });
  it('is open after the opening count, or when a sale already counts today', () => {
    expect(registerStatus({ hasOpening: true, hasCountedSale: false, hasClosing: false })).toBe('open');
    expect(registerStatus({ hasOpening: false, hasCountedSale: true, hasClosing: false })).toBe('open');
  });
  it('is closed once the day has a closing, whatever else is true', () => {
    expect(registerStatus({ hasOpening: true, hasCountedSale: true, hasClosing: true })).toBe('closed');
    expect(registerStatus({ hasOpening: false, hasCountedSale: false, hasClosing: true })).toBe('closed');
  });
});

describe('sumDenominations', () => {
  it('adds notes and coins', () => {
    expect(sumDenominations({ 100_000: 2, 20_000: 3, 2_000: 4, 500: 3, 100: 2 })).toBe(269_700);
  });
  it('ignores empty, negative and fractional counts', () => {
    expect(sumDenominations({})).toBe(0);
    expect(sumDenominations({ 50_000: -1, 10_000: 1.5, 5_000: undefined, 1_000: 1 })).toBe(1_000);
  });
  it('lists notes largest first', () => {
    expect([...DENOMINATIONS].sort((a, b) => b - a)).toEqual(DENOMINATIONS);
  });
});

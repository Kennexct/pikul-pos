import { describe, expect, it } from 'vitest';
import { registerStatus } from './register';

describe('registerStatus', () => {
  it('asks to open when nothing happened today', () => {
    expect(registerStatus({ hasOpening: false, hasCountedSale: false, closedShifts: 0 })).toBe('not_open');
  });
  it('is open after the opening count, or when a sale already counts in the running shift', () => {
    expect(registerStatus({ hasOpening: true, hasCountedSale: false, closedShifts: 0 })).toBe('open');
    expect(registerStatus({ hasOpening: false, hasCountedSale: true, closedShifts: 0 })).toBe('open');
  });
  it('is closed after a closing until the next shift is opened (ADR-027)', () => {
    expect(registerStatus({ hasOpening: false, hasCountedSale: false, closedShifts: 1 })).toBe('closed');
    expect(registerStatus({ hasOpening: true, hasCountedSale: false, closedShifts: 1 })).toBe('open');
    expect(registerStatus({ hasOpening: false, hasCountedSale: true, closedShifts: 2 })).toBe('open');
  });
});

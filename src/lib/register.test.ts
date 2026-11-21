import { describe, expect, it } from 'vitest';
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

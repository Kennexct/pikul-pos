import { describe, expect, it } from 'vitest';
import { formatReceiptNo, getBusinessDate, normalizeReceiptPrefix } from './businessDate';
import { uuidv7 } from './id';

describe('getBusinessDate', () => {
  const store = { timezone: 'Asia/Jakarta', dayCutoff: '04:00' } as const;

  it('counts a 01:30 WIB sale toward the previous day for night sellers', () => {
    // 2026-11-19 01:30 WIB = 2026-11-18 18:30 UTC
    expect(getBusinessDate(new Date('2026-11-18T18:30:00Z'), store)).toBe('2026-11-18');
  });

  it('counts a 05:00 WIB sale toward the same day', () => {
    // 2026-11-19 05:00 WIB = 2026-11-18 22:00 UTC
    expect(getBusinessDate(new Date('2026-11-18T22:00:00Z'), store)).toBe('2026-11-19');
  });
});

describe('formatReceiptNo', () => {
  it('formats with device prefix and padded sequence', () => {
    expect(formatReceiptNo('2026-11-18', 'A1', 42)).toBe('INV-20261118-A10042');
  });

  it('rejects invalid device codes', () => {
    expect(() => formatReceiptNo('2026-11-18', 'a', 1)).toThrow();
  });

  it('uses the store prefix, cleaned to A-Z/0-9 and 6 characters', () => {
    expect(formatReceiptNo('2026-11-18', 'A1', 7, 'BKS')).toBe('BKS-20261118-A10007');
    expect(formatReceiptNo('2026-11-18', 'A1', 7, 'bakso pak-budi')).toBe('BAKSOP-20261118-A10007');
    expect(formatReceiptNo('2026-11-18', 'A1', 7, '  ')).toBe('INV-20261118-A10007');
  });
});

describe('normalizeReceiptPrefix', () => {
  it('falls back to INV when empty', () => {
    expect(normalizeReceiptPrefix(undefined)).toBe('INV');
    expect(normalizeReceiptPrefix('--')).toBe('INV');
    expect(normalizeReceiptPrefix('wr1')).toBe('WR1');
  });
});

describe('uuidv7', () => {
  it('produces version 7 ids that sort by time', () => {
    const first = uuidv7(1_000);
    const second = uuidv7(2_000);
    expect(first[14]).toBe('7');
    expect(first < second).toBe(true);
  });
});

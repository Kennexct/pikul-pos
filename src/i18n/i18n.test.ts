import { describe, expect, it } from 'vitest';
import { EN } from './en';
import { lang, t, translate, type Msg } from './index';

const placeholders = (text: string) => [...text.matchAll(/\{(\d+)/g)].map((m) => m[1]).sort().filter((v, i, all) => all.indexOf(v) === i);

describe('i18n (ADR-010)', () => {
  it('runs in Indonesian under test, where the key is the text', () => {
    expect(lang).toBe('id');
    expect(t('Bayar')).toBe('Bayar');
    expect(t('{0} dihapus', 'GoPay')).toBe('GoPay dihapus');
  });

  it('translates to English with arguments in any order', () => {
    expect(translate('en', 'Bayar')).toBe('Pay');
    expect(translate('en', '{0} dihapus', 'GoPay')).toBe('GoPay deleted');
    expect(translate('en', '{0}, ditutup {1} oleh {2}', 'Thursday', '21:30', 'Dika')).toBe('Thursday, closed 21:30 by Dika');
  });

  it('picks singular or plural words in English', () => {
    expect(translate('en', '{0} pesanan belum dibayar', 1)).toBe('1 unpaid order');
    expect(translate('en', '{0} pesanan belum dibayar', 3)).toBe('3 unpaid orders');
    expect(translate('en', '{0} salah. Sisa {1} percobaan.', 'PIN', 1)).toBe('Wrong PIN. 1 attempt left.');
  });

  it('uses a context hint when one Indonesian word has two meanings', () => {
    expect([translate('id', 'Kasir'), translate('id', 'Kasir::orang')]).toEqual(['Kasir', 'Kasir']);
    expect([translate('en', 'Kasir'), translate('en', 'Kasir::orang')]).toEqual(['Register', 'Cashier']);
    expect(translate('en', 'Kembali::uang')).toBe('Change');
  });

  it('every English entry keeps the placeholders and the outer spacing of its key', () => {
    for (const [key, value] of Object.entries(EN)) {
      expect(placeholders(value), key).toEqual(placeholders(key));
      expect(value.length - value.trimStart().length, key).toBe(key.length - key.trimStart().length);
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it('plural forms are only used where the sentence has that argument', () => {
    const offenders = (Object.keys(EN) as Msg[]).filter((key) => /\{\d+\|/.test(EN[key]) && !/\{\d+\}/.test(key));
    expect(offenders).toEqual([]);
  });

  it('a plural word never replaces the number itself', () => {
    const offenders = Object.entries(EN).filter(([, value]) => [...value.matchAll(/\{(\d+)\|/g)].some((m) => !value.includes(`{${m[1]}}`)));
    expect(offenders.map(([key]) => key)).toEqual([]);
    expect(translate('en', 'Coba gratis, sisa {0} hari (sampai {1}).', 12, '5 December 2026')).toBe('Free trial, 12 days left (until 5 December 2026).');
  });
});

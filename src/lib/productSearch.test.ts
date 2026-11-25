import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { matchProduct, normalizeSearch, searchProducts } from './productSearch';

const product = (id: string, name: string, variants: string[] = []): Product =>
  ({
    id,
    name,
    variants: variants.map((v, i) => ({ id: `${id}-${i}`, name: v, price: 10000, sortOrder: i })),
  }) as unknown as Product;

const kopi = product('p1', 'Kopi', ['Latte', 'Americano', 'Kopi Susu Gula Aren']);
const teh = product('p2', 'Es Teh Manis');

describe('productSearch', () => {
  it('normalizes case, accents and spaces', () => {
    expect(normalizeSearch('  Café   LATTE ')).toBe('cafe latte');
  });

  it('matches on the product name with no variant hits', () => {
    expect(matchProduct(kopi, 'kop')).toEqual([]);
    expect(matchProduct(teh, 'teh')).toEqual([]);
    expect(matchProduct(kopi, '')).toEqual([]);
  });

  it('finds the parent product through a variant name', () => {
    expect(matchProduct(kopi, 'latte')).toEqual(['Latte']);
    expect(matchProduct(kopi, 'AMERI')).toEqual(['Americano']);
  });

  it('matches words across product and variant names', () => {
    expect(matchProduct(kopi, 'kopi latte')).toEqual(['Latte']);
    expect(matchProduct(kopi, 'gula aren')).toEqual(['Kopi Susu Gula Aren']);
  });

  it('returns null when nothing matches', () => {
    expect(matchProduct(kopi, 'teh')).toBeNull();
    expect(matchProduct(teh, 'latte')).toBeNull();
  });

  it('maps every matching product to its variant hits', () => {
    const result = searchProducts([kopi, teh], 'latte');
    expect([...result.keys()]).toEqual(['p1']);
    expect(result.get('p1')).toEqual(['Latte']);
  });
});

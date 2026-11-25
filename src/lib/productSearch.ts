import type { Product } from '../types';
import { activeVariants } from './productVariants';

/** Lower case, accents dropped ("Café" → "cafe"), runs of spaces collapsed. */
export const normalizeSearch = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const containsAll = (haystack: string, words: readonly string[]): boolean => words.every((w) => haystack.includes(w));

/**
 * Offline menu search over a product and its variants (Kenny, v0.19.6).
 * Every typed word must appear in the product name, or in "product name + one variant name"
 * (so "kopi latte" and "latte" both find Kopi → Latte).
 * Returns null when the product does not match; otherwise the names of the variants that made it match
 * (empty when the product name alone matches, or the query is empty).
 */
export function matchProduct(product: Product, query: string): string[] | null {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const name = normalizeSearch(product.name);
  if (containsAll(name, words)) return [];
  const hits = activeVariants(product)
    .filter((v) => containsAll(`${name} ${normalizeSearch(v.name)}`, words))
    .map((v) => v.name);
  return hits.length > 0 ? hits : null;
}

/** Products that match the query, keyed by id to the variant names that matched (see `matchProduct`). */
export function searchProducts(products: readonly Product[], query: string): Map<Product['id'], string[]> {
  const result = new Map<Product['id'], string[]>();
  for (const product of products) {
    const hits = matchProduct(product, query);
    if (hits) result.set(product.id, hits);
  }
  return result;
}

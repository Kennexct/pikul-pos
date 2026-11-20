import type { Rupiah } from '../types';

/** Rupiah notes and coins in circulation, largest first — for counting the drawer (ADR-017). */
export const DENOMINATIONS: readonly Rupiah[] = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100];

/** Coins start at Rp1.000 (both a note and a coin exist); everything below is coins only. */
export const isCoin = (value: Rupiah): boolean => value < 1_000;

/** Count per denomination -> total. Ignores empty, negative and non-integer counts. */
export function sumDenominations(counts: Readonly<Record<number, number | undefined>>): Rupiah {
  return DENOMINATIONS.reduce((sum, value) => {
    const count = counts[value];
    return count !== undefined && Number.isSafeInteger(count) && count > 0 ? sum + value * count : sum;
  }, 0);
}

/**
 * Whether today's register (cash drawer) is ready for selling (ADR-017). Pure, so the rule is tested.
 * - closed: the day has a live closing
 * - open: an opening cash was recorded, or a sale already counts on the day (device updated mid-day)
 * - not_open: neither — the cashier asks for the opening count before the first sale
 */
export type RegisterStatus = 'not_open' | 'open' | 'closed';

export interface RegisterFacts {
  hasOpening: boolean;
  hasCountedSale: boolean;
  hasClosing: boolean;
}

export function registerStatus({ hasOpening, hasCountedSale, hasClosing }: RegisterFacts): RegisterStatus {
  if (hasClosing) return 'closed';
  return hasOpening || hasCountedSale ? 'open' : 'not_open';
}

/**
 * Whether this device's register (cash drawer) is ready for selling (ADR-017, ADR-027). Pure, so the rule is tested.
 * - open: the running shift has an opening count, or a sale already counts in it (device updated mid-day)
 * - closed: a shift was closed today and the next one has not started — opening again starts a new shift
 * - not_open: nothing yet today — the cashier asks for the opening count before the first sale
 */
export type RegisterStatus = 'not_open' | 'open' | 'closed';

export interface RegisterFacts {
  hasOpening: boolean;
  hasCountedSale: boolean;
  /** Shifts already closed today. */
  closedShifts: number;
}

export function registerStatus({ hasOpening, hasCountedSale, closedShifts }: RegisterFacts): RegisterStatus {
  if (hasOpening || hasCountedSale) return 'open';
  return closedShifts > 0 ? 'closed' : 'not_open';
}

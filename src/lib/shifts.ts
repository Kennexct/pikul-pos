import type { DayClosing, IsoDateTime, Order } from '../types';
import { DATE_LOCALE } from '../i18n';

/**
 * Shifts within one business day on one device (ADR-027). Pure, so the rules are tested.
 * A shift ends with its closing ("Tutup kasir"). Opening the register again the same day starts the next shift;
 * a closed shift is never continued. Records belong to a shift by time: after the previous closing, up to its own.
 */

/** Closings made before shifts existed have no number: they are shift 1. */
export const shiftNoOf = (closing: Pick<DayClosing, 'shiftNo'>): number => closing.shiftNo ?? 1;

/** Live closings in shift order. */
export function sortShifts<T extends Pick<DayClosing, 'shiftNo' | 'closedAt' | 'deletedAt'>>(closings: readonly T[]): T[] {
  return closings.filter((c) => !c.deletedAt).sort((a, b) => shiftNoOf(a) - shiftNoOf(b) || a.closedAt.localeCompare(b.closedAt));
}

/** The shift that is running now, or would start next: one after the last closed shift. */
export const currentShiftNo = (closings: readonly Pick<DayClosing, 'shiftNo' | 'deletedAt'>[]): number =>
  closings.reduce((max, c) => (c.deletedAt ? max : Math.max(max, shiftNoOf(c))), 0) + 1;

export interface ShiftWindow {
  /** Exclusive: the previous shift's closing time, or null for the first shift of the day. */
  after: IsoDateTime | null;
  /** Inclusive: this shift's closing time, or null while it is still running. */
  until: IsoDateTime | null;
}

/** Time window of shift `shiftNo`, from the day's live closings. */
export function shiftWindow(closings: readonly Pick<DayClosing, 'shiftNo' | 'closedAt' | 'deletedAt'>[], shiftNo: number): ShiftWindow {
  const sorted = sortShifts(closings);
  const own = sorted.find((c) => shiftNoOf(c) === shiftNo);
  const previous = sorted.filter((c) => shiftNoOf(c) < shiftNo).at(-1);
  return { after: previous?.closedAt ?? null, until: own?.closedAt ?? null };
}

export function isInWindow(at: IsoDateTime, window: ShiftWindow): boolean {
  return (window.after === null || at > window.after) && (window.until === null || at <= window.until);
}

/** When a sale counts in a drawer: when it was paid (a saved order paid later counts in the later shift). */
export const saleTime = (order: Pick<Order, 'paidAt' | 'createdAt'>): IsoDateTime => order.paidAt ?? order.createdAt;

/** "14:05" in the store's time zone. */
export const formatClockTime = (at: IsoDateTime, timeZone: string): string =>
  new Intl.DateTimeFormat(DATE_LOCALE, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(at));

import type { BusinessDate, Store } from '../types';
import { t } from '../i18n';

const RECEIPT_SEQ_DIGITS = 4;

/**
 * Business date in the store's timezone, shifted by the day cut-off.
 * A night seller with cut-off 04:00 who sells at 01:30 on the 19th records it on the 18th.
 */
export function getBusinessDate(at: Date, store: Pick<Store, 'timezone' | 'dayCutoff'>): BusinessDate {
  const [cutHour, cutMinute] = store.dayCutoff.split(':').map(Number);
  const shifted = new Date(at.getTime() - ((cutHour ?? 0) * 60 + (cutMinute ?? 0)) * 60_000);
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: store.timezone }).format(shifted);
}

export const RECEIPT_PREFIX_DEFAULT = 'INV';
export const RECEIPT_PREFIX_MAX = 6;

/** What the seller typed → a safe prefix: A–Z and 0–9 only, upper case, at most 6 characters. Empty = "INV". */
export function normalizeReceiptPrefix(input: string | undefined): string {
  const clean = (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, RECEIPT_PREFIX_MAX);
  return clean === '' ? RECEIPT_PREFIX_DEFAULT : clean;
}

/** <PREFIX>-YYYYMMDD-<device 2 chars><seq 4>, e.g. INV-20261118-A10042; the prefix is set per store (Toko & Struk). */
export function formatReceiptNo(businessDate: BusinessDate, deviceCode: string, seq: number, prefix?: string): string {
  if (!/^[A-Z0-9]{2}$/.test(deviceCode)) {
    throw new Error(t('Device code must be 2 uppercase alphanumerics, got "{0}"', deviceCode));
  }
  const compactDate = businessDate.replace(/-/g, '');
  return `${normalizeReceiptPrefix(prefix)}-${compactDate}-${deviceCode}${String(seq).padStart(RECEIPT_SEQ_DIGITS, '0')}`;
}

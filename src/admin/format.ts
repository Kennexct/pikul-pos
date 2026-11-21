import { DATE_LOCALE, t } from '../i18n';
import { formatRupiah } from '../lib/money';
import type { AccountView, Payment } from './api';

/** Display helpers for the business console. Times are shown in Asia/Jakarta (WIB). */
const TZ = 'Asia/Jakarta';
const dateFmt = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat(DATE_LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDayFmt = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDayFmt = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const numFmt = new Intl.NumberFormat(DATE_LOCALE);
const pctFmt = new Intl.NumberFormat(DATE_LOCALE, { style: 'percent', maximumFractionDigits: 0 });

export const rp = formatRupiah;
export const num = (n: number) => numFmt.format(n);
export const pct = (part: number, whole: number) => (whole > 0 ? pctFmt.format(part / whole) : '–');
export const fmtDate = (ms: number) => dateFmt.format(ms);
export const fmtDateTime = (ms: number) => dateTimeFmt.format(ms);
/** YYYY-MM-DD → "21 Nov". */
export const fmtDay = (d: string) => shortDayFmt.format(Date.parse(`${d}T00:00:00Z`));
export const fmtDayLong = (d: string) => longDayFmt.format(Date.parse(`${d}T00:00:00Z`));
/** YYYY-MM → "November 2026". */
export const fmtMonth = (m: string) => monthFmt.format(Date.parse(`${m}-01T00:00:00Z`));

export function ago(ms: number | null, now: number): string {
  if (ms === null) return t('Belum pernah');
  const days = Math.floor((now - ms) / 86_400_000);
  if (days <= 0) return t('Hari ini');
  if (days === 1) return t('Kemarin');
  return t('{0} hari lalu', days);
}

/** "3 hari lagi" / "lewat 2 hari". */
export function until(ms: number, now: number): string {
  const days = Math.ceil((ms - now) / 86_400_000);
  if (days > 1) return t('{0} hari lagi', days);
  if (days === 1) return t('Besok');
  if (days === 0) return t('Hari ini');
  return t('Lewat {0} hari', -days);
}

export const STATUS_LABEL: Record<AccountView['status'], string> = {
  trial: t('Masa coba'),
  paid: t('Berbayar'),
  expired: t('Kedaluwarsa'),
};
export const STATUS_CLASS: Record<AccountView['status'], string> = {
  trial: 'bg-subtle text-ink-soft',
  paid: 'bg-brand-50 text-brand-700',
  expired: 'bg-danger-50 text-danger-700',
};

export const METHOD_LABEL: Record<Payment['method'], string> = {
  transfer: t('Transfer bank'),
  qris: 'QRIS',
  ewallet: t('E-wallet'),
  cash: t('Tunai'),
  other: t('Lainnya'),
};

export const PAY_TYPE_LABEL: Record<string, string> = {
  cash: t('Tunai'),
  qris: 'QRIS',
  transfer: t('Transfer bank'),
  ewallet: t('E-wallet'),
  other: t('Lainnya'),
};

export const WEEKDAYS = [t('Minggu'), t('Senin'), t('Selasa'), t('Rabu'), t('Kamis'), t('Jumat'), t('Sabtu')];

/** Today in WIB as YYYY-MM-DD, and n days before it. */
export const todayWib = (now = Date.now()) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
export const daysBefore = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

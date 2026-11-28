import type { Customer, Id, Order } from '../types';
import { formatRupiah } from './money';
import { isCountedSale } from './reports';
import { DATE_LOCALE, t } from '../i18n';

/** Customer helpers (ADR-005). Phones are stored canonically as `+628…`. */
const CANONICAL_PHONE = /^\+628\d{7,12}$/;

/** Accepts `0812…`, `62812…`, `+62 812-…`, `812…`; returns `+628…` or null when it is not an Indonesian mobile number. */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[^\d+]/g, '');
  let rest: string;
  if (compact.startsWith('+62')) rest = compact.slice(3);
  else if (compact.startsWith('62')) rest = compact.slice(2);
  else if (compact.startsWith('0')) rest = compact.slice(1);
  else if (compact.startsWith('8')) rest = compact;
  else return null;
  const canonical = `+62${rest}`;
  return CANONICAL_PHONE.test(canonical) ? canonical : null;
}

/** `+6281234567890` → `0812-3456-7890` (how people read numbers aloud). */
export function formatPhone(phone: string): string {
  return `0${phone.slice(3)}`.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}

/** Number part for `https://wa.me/<number>`. */
/** One plain address in lower case, or null (ADR-028). Same rule as the server. */
export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[a-z]{2,}$/.test(e) ? e : null;
}

export const toWhatsAppNumber = (phone: string): string => phone.replace(/\D/g, '');

const MIN_PHONE_QUERY_DIGITS = 3;

/** Matches name (case-insensitive substring) or phone digits typed in any common form. */
export function searchCustomers<T extends Pick<Customer, 'name' | 'phone'>>(customers: readonly T[], query: string): T[] {
  const text = query.trim().toLowerCase();
  if (text === '') return [...customers];
  const digits = text.replace(/\D/g, '');
  const phoneQuery = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  const canMatchPhone = digits.length >= MIN_PHONE_QUERY_DIGITS;
  return customers.filter(
    (c) => c.name.toLowerCase().includes(text) || (canMatchPhone && c.phone !== undefined && toWhatsAppNumber(c.phone).includes(phoneQuery)),
  );
}

export interface CustomerStats {
  visits: number;
  /** Gross of completed sales (refunds are shown on the orders themselves). */
  totalSpend: number;
  lastVisitAt: string | null;
  openOrders: number;
  /** What the customer still owes: the sum of their saved, unpaid orders (ADR-006 — derived, no ledger). */
  openAmount: number;
  oldestOpenAt: string | null;
}

export const NO_STATS: CustomerStats = { visits: 0, totalSpend: 0, lastVisitAt: null, openOrders: 0, openAmount: 0, oldestOpenAt: null };

export function customerStats(orders: readonly Order[]): Map<Id, CustomerStats> {
  const stats = new Map<Id, CustomerStats>();
  for (const order of orders) {
    if (!order.customerId) continue;
    const current = stats.get(order.customerId) ?? NO_STATS;
    if (order.status === 'open') {
      stats.set(order.customerId, {
        ...current,
        openOrders: current.openOrders + 1,
        openAmount: current.openAmount + order.totals.grandTotal,
        oldestOpenAt: current.oldestOpenAt && current.oldestOpenAt < order.createdAt ? current.oldestOpenAt : order.createdAt,
      });
    } else if (isCountedSale(order)) {
      const paidAt = order.paidAt ?? order.updatedAt;
      stats.set(order.customerId, {
        ...current,
        visits: current.visits + 1,
        totalSpend: current.totalSpend + order.totals.grandTotal,
        lastVisitAt: current.lastVisitAt && current.lastVisitAt > paidAt ? current.lastVisitAt : paidAt,
      });
    }
  }
  return stats;
}

/** WhatsApp text reminding a customer of their unpaid orders. Pure, so the wording is tested. */
export function buildDebtReminder(input: { storeName: string; customerName: string; orders: readonly Order[]; timeZone: string }): string {
  const open = input.orders.filter((o) => o.status === 'open').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const format = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: input.timeZone });
  const lines = open.map((o) => `- ${format.format(new Date(o.createdAt))}${o.label ? ` · ${o.label}` : ''} · ${formatRupiah(o.totals.grandTotal)}`);
  const total = open.reduce((sum, o) => sum + o.totals.grandTotal, 0);
  return [
    t('Halo {0}, ini dari {1}.', input.customerName, input.storeName),
    '',
    open.length === 1 ? t('Kami ingin mengingatkan pesanan yang belum dibayar:') : t('Kami ingin mengingatkan {0} pesanan yang belum dibayar:', open.length),
    ...lines,
    '',
    t('Total: {0}', formatRupiah(total)),
    '',
    t('Terima kasih.'),
  ].join('\n');
}

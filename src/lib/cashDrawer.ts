import type { ClosingMethodTotal, DayClosing, Expense, Id, Order, Refund } from '../types';
import { formatRupiah } from './money';
import { formatClockTime, shiftNoOf } from './shifts';
import { isCountedSale, summarize } from './reports';
import { DATE_LOCALE, t } from '../i18n';

/**
 * Drawer maths for one business day (ADR-007). Used by the live Kas screen AND stored by "Tutup kasir",
 * so what the seller saw is what gets recorded.
 */
export interface DrawerInput {
  openingCash: number;
  /** Orders whose sale business date is the day (any status except open). */
  sales: readonly Order[];
  /** Refund/void records made on the day. */
  refunds: readonly Refund[];
  /** Must contain the original order of every refund. */
  ordersById: ReadonlyMap<Id, Order>;
  /** Live expenses of the day. */
  expenses: readonly Expense[];
  /** Saved orders nobody has paid yet (any day). */
  openOrders: readonly Order[];
}

export type Drawer = Pick<
  DayClosing,
  | 'openingCash'
  | 'cashSales'
  | 'cashRefunds'
  | 'drawerExpenses'
  | 'expectedCash'
  | 'netSales'
  | 'transactions'
  | 'expensesTotal'
  | 'byMethod'
  | 'openOrderCount'
  | 'openOrderAmount'
>;

export function buildDrawer(input: DrawerInput): Drawer {
  const counted = input.sales.filter(isCountedSale);
  const summary = summarize(input.sales, input.refunds);
  const methods = new Map<Id, ClosingMethodTotal>();
  const addTo = (key: Id, name: string, type: ClosingMethodTotal['type'], amount: number) => {
    const row = methods.get(key) ?? { name, type, amount: 0 };
    methods.set(key, { ...row, amount: row.amount + amount });
  };

  let cashSales = 0;
  for (const order of counted) {
    for (const payment of order.payments) {
      addTo(payment.paymentMethodId, payment.methodNameSnapshot, payment.methodType, payment.amount);
      if (payment.methodType === 'cash') cashSales += payment.amount;
    }
  }

  // A refund goes back the way the sale was paid.
  let cashRefunds = 0;
  for (const refund of input.refunds) {
    if (refund.kind !== 'refund') continue;
    const paidWith = input.ordersById.get(refund.orderId)?.payments[0];
    if (!paidWith) continue;
    addTo(paidWith.paymentMethodId, paidWith.methodNameSnapshot, paidWith.methodType, -refund.amount);
    if (paidWith.methodType === 'cash') cashRefunds += refund.amount;
  }

  const expenses = input.expenses.filter((e) => !e.deletedAt);
  const drawerExpenses = expenses.filter((e) => e.isFromDrawer).reduce((sum, e) => sum + e.amount, 0);

  return {
    openingCash: input.openingCash,
    cashSales,
    cashRefunds,
    drawerExpenses,
    expectedCash: input.openingCash + cashSales - cashRefunds - drawerExpenses,
    netSales: summary.netSales,
    transactions: summary.transactions,
    expensesTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
    byMethod: [...methods.values()].sort((a, b) => b.amount - a.amount),
    openOrderCount: input.openOrders.length,
    openOrderAmount: input.openOrders.reduce((sum, o) => sum + o.totals.grandTotal, 0),
  };
}

/** "pas" / "lebih Rp…" / "kurang Rp…" */
export function describeDifference(difference: number): string {
  if (difference === 0) return t('pas');
  return `${difference > 0 ? t('lebih') : t('kurang')} ${formatRupiah(Math.abs(difference))}`;
}

/** True when the day changed after it was closed (late sale, refund or expense). */
export function isClosingStale(closing: DayClosing, live: Drawer): boolean {
  return (
    closing.cashSales !== live.cashSales ||
    closing.cashRefunds !== live.cashRefunds ||
    closing.drawerExpenses !== live.drawerExpenses ||
    closing.netSales !== live.netSales ||
    closing.expensesTotal !== live.expensesTotal
  );
}

/** Plain-text closing summary for WhatsApp. Pure, so the wording is tested. */
export function buildClosingText(input: { storeName: string; closing: DayClosing; closedByName: string; timeZone: string }): string {
  const { closing } = input;
  const day = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${closing.businessDate}T00:00:00Z`),
  );
  const time = formatClockTime(closing.closedAt, input.timeZone);
  const shift = shiftNoOf(closing);
  const minus = (amount: number) => (amount === 0 ? formatRupiah(0) : `-${formatRupiah(amount)}`);

  return [
    shift > 1 ? t('Tutup kasir {0} · Shift {1}', input.storeName, shift) : t('Tutup kasir {0}', input.storeName),
    t('{0}, ditutup {1} oleh {2}', day, time, input.closedByName),
    '',
    t('Penjualan bersih: {0} ({1} transaksi)', formatRupiah(closing.netSales), closing.transactions),
    ...closing.byMethod.map((m) => `- ${m.name}: ${formatRupiah(m.amount)}`),
    t('Pengeluaran: {0}', formatRupiah(closing.expensesTotal)),
    '',
    t('Kas laci'),
    t('Modal awal: {0}', formatRupiah(closing.openingCash)),
    t('Penjualan tunai: {0}', formatRupiah(closing.cashSales)),
    t('Refund tunai: {0}', minus(closing.cashRefunds)),
    t('Pengeluaran dari laci: {0}', minus(closing.drawerExpenses)),
    t('Seharusnya: {0}', formatRupiah(closing.expectedCash)),
    t('Dihitung: {0}', formatRupiah(closing.countedCash)),
    t('Selisih: {0}', describeDifference(closing.difference)),
    ...(closing.openOrderCount > 0 ? ['', t('Belum dibayar: {0} pesanan ({1})', closing.openOrderCount, formatRupiah(closing.openOrderAmount))] : []),
    ...(closing.note ? ['', t('Catatan: {0}', closing.note)] : []),
  ].join('\n');
}

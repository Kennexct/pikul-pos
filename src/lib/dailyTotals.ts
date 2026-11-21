import type { BusinessDate, Order, PaymentType, Refund } from '../types';
import { PAYMENT_TYPES } from '../types';
import { buildReport, type Report, type ReportInput } from './reports';

/**
 * One business day's totals as sent to Pikul (ADR-020). Built from the same `buildReport` as the merchant's own
 * Laporan, so the numbers match. Totals only: no receipt lines, product names, customers, staff or notes.
 */
export interface TxTotals {
  transactions: number;
  gross: number;
  refunds: number;
}
export interface DailyTotalsRow {
  businessDate: BusinessDate;
  transactions: number;
  gross: number;
  discounts: number;
  refunds: number;
  net: number;
  voidCount: number;
  voidAmount: number;
  itemsSold: number;
  pay: Record<PaymentType, TxTotals>;
  modes: (TxTotals & { name: string })[];
  hours: { transactions: number; gross: number }[];
  computedAt: number;
}

export const MAX_MODES = 12;
const zero = (): TxTotals => ({ transactions: 0, gross: 0, refunds: 0 });

/** Payment method id → payment type, from the orders' own payment snapshots. */
function methodTypes(orders: Iterable<Order>): Map<string, PaymentType> {
  const map = new Map<string, PaymentType>();
  for (const o of orders) for (const p of o.payments) map.set(p.paymentMethodId, p.methodType);
  return map;
}

export function toDailyRow(report: Report, date: BusinessDate, types: ReadonlyMap<string, PaymentType>, computedAt: number): DailyTotalsRow {
  const s = report.summary;
  const pay = Object.fromEntries(PAYMENT_TYPES.map((k) => [k, zero()])) as Record<PaymentType, TxTotals>;
  for (const r of report.byPaymentMethod) {
    const k = types.get(r.key) ?? 'other';
    pay[k].transactions += r.transactions;
    pay[k].gross += r.gross;
    pay[k].refunds += r.refunds;
  }
  const modes = report.bySalesMode.map((r) => ({ name: r.label.trim().slice(0, 40) || '-', transactions: r.transactions, gross: r.gross, refunds: r.refunds }));
  if (modes.length > MAX_MODES) {
    const rest = modes.splice(MAX_MODES - 1);
    modes.push(rest.reduce((a, m) => ({ ...a, transactions: a.transactions + m.transactions, gross: a.gross + m.gross, refunds: a.refunds + m.refunds }), { name: 'Lainnya', ...zero() }));
  }
  return {
    businessDate: date,
    transactions: s.transactions,
    gross: s.grossSales,
    discounts: s.discounts,
    refunds: s.refunds,
    net: s.netSales,
    voidCount: s.voidCount,
    voidAmount: s.voidAmount,
    itemsSold: Math.round(s.itemsSold * 1000) / 1000,
    pay,
    modes,
    hours: report.byHour.map((h) => ({ transactions: h.transactions, gross: h.gross })),
    computedAt,
  };
}

/** Rows for each date, from one period's data (sales by sale date, refunds by refund date — ADR-002). */
export function dailyRows(input: Omit<ReportInput, 'range' | 'sales' | 'refunds'> & { sales: readonly Order[]; refunds: readonly Refund[] }, dates: readonly BusinessDate[], computedAt: number): DailyTotalsRow[] {
  const types = methodTypes(input.ordersById.values());
  return dates.map((date) => {
    const report = buildReport({ ...input, range: { from: date, to: date }, sales: input.sales.filter((o) => o.businessDate === date), refunds: input.refunds.filter((r) => r.businessDate === date) });
    return toDailyRow(report, date, types, computedAt);
  });
}

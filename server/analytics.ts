import { SALE_PAY_TYPES, type AccountLite, type DateSpan, type DaySeriesRow, type MerchantTotal, type NamedTotal, type Payment, type SalePayType } from './adminTypes';
import { isResponse, requireAdmin } from './adminAuth';
import { entitledUntil } from './auth';
import { toCsv } from './csv';
import { isDate, jakartaDate, JAKARTA_MS, statusOf } from './ledger';
import { DAY_MS, type ApiResponse, type Deps, type RequestCtx } from './types';

/** Executive reports for the console (ADR-020): per merchant and across all merchants, from daily totals + accounts + payments. */

export const MAX_SPAN_DAYS = 366;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const spanDays = (s: DateSpan) => Math.round((dayMs(s.to) - dayMs(s.from)) / DAY_MS) + 1;
const addDays = (d: string, n: number) => new Date(dayMs(d) + n * DAY_MS).toISOString().slice(0, 10);
/** Start of the span in real time (00:00 WIB) and the end (exclusive). */
const spanMs = (s: DateSpan) => ({ start: dayMs(s.from) - JAKARTA_MS, end: dayMs(s.to) + DAY_MS - JAKARTA_MS });

export function readSpan(ctx: RequestCtx, now: number, defaultDays = 30): DateSpan | null {
  const to = ctx.query.get('to') ?? jakartaDate(now);
  const from = ctx.query.get('from') ?? addDays(to, -(defaultDays - 1));
  if (!isDate(from) || !isDate(to) || from > to) return null;
  return spanDays({ from, to }) <= MAX_SPAN_DAYS ? { from, to } : null;
}

export interface Totals {
  transactions: number;
  gross: number;
  discounts: number;
  refunds: number;
  net: number;
  voidCount: number;
  averageTicket: number;
}
function totalsOf(days: readonly DaySeriesRow[]): Totals {
  const t = { transactions: 0, gross: 0, discounts: 0, refunds: 0, net: 0, voidCount: 0 };
  for (const d of days) {
    t.transactions += d.transactions;
    t.gross += d.gross;
    t.discounts += d.discounts;
    t.refunds += d.refunds;
    t.net += d.net;
    t.voidCount += d.voidCount;
  }
  return { ...t, averageTicket: t.transactions ? Math.round(t.gross / t.transactions) : 0 };
}
function payMix(days: readonly DaySeriesRow[]) {
  return SALE_PAY_TYPES.map((type: SalePayType) => ({
    type,
    transactions: days.reduce((s, d) => s + d.pay[type].transactions, 0),
    gross: days.reduce((s, d) => s + d.pay[type].gross, 0),
    refunds: days.reduce((s, d) => s + d.pay[type].refunds, 0),
  }));
}
/** Every date of the span, zeros where nothing was sent. */
function fillDays(span: DateSpan, days: readonly DaySeriesRow[]) {
  const by = new Map(days.map((d) => [d.date, d]));
  return Array.from({ length: spanDays(span) }, (_, i) => {
    const date = addDays(span.from, i);
    const d = by.get(date);
    return { date, merchants: d?.merchants ?? 0, transactions: d?.transactions ?? 0, gross: d?.gross ?? 0, net: d?.net ?? 0 };
  });
}
export function weekdays(days: readonly { date: string; transactions: number; net: number }[]) {
  const out = Array.from({ length: 7 }, (_, weekday) => ({ weekday, transactions: 0, net: 0, days: 0 }));
  for (const d of days) {
    const w = out[new Date(dayMs(d.date)).getUTCDay()];
    w.transactions += d.transactions;
    w.net += d.net;
    w.days++;
  }
  return out;
}

export interface MerchantSummary {
  span: DateSpan;
  totals: Totals;
  activeDays: number;
  byPay: ReturnType<typeof payMix>;
  byMode: NamedTotal[];
  days: ReturnType<typeof fillDays>;
  hours: { hour: number; transactions: number; gross: number }[];
}

export async function adminMerchantSummary(deps: Deps, auth: string | null, id: string, ctx: RequestCtx): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const span = readSpan(ctx, deps.now());
  if (!span) return { status: 400, body: { error: 'invalid_range' } };
  if (!(await deps.repo.findAccountById(id))) return { status: 404, body: { error: 'not_found' } };
  const [days, byMode, hours] = await Promise.all([deps.repo.dailySeries(span, id), deps.repo.modeTotals(span, id), deps.repo.hourTotals(span, id)]);
  const body: MerchantSummary = { span, totals: totalsOf(days), activeDays: days.filter((d) => d.transactions > 0).length, byPay: payMix(days), byMode, days: fillDays(span, days), hours };
  return { status: 200, body };
}

/** Merchants grouped by average transactions per day in the span. */
export const BUCKETS = ['0', '1-10', '11-50', '51+'] as const;
export const bucketOf = (avg: number) => (avg <= 0 ? 0 : avg <= 10 ? 1 : avg <= 50 ? 2 : 3);

/** Monday (ISO week start) of a date. */
const weekStart = (d: string) => addDays(d, -((new Date(dayMs(d)).getUTCDay() + 6) % 7));

export function businessReport(span: DateSpan, now: number, accounts: readonly AccountLite[], payments: readonly Payment[], perMerchant: readonly MerchantTotal[]) {
  const { start, end } = spanMs(span);
  const live = payments.filter((p) => p.cancelledAt === null && p.paidOn >= span.from && p.paidOn <= span.to);
  const months = new Map<string, number>();
  for (const p of live) months.set(p.paidOn.slice(0, 7), (months.get(p.paidOn.slice(0, 7)) ?? 0) + p.amount);
  const weeks = new Map<string, number>();
  for (let d = weekStart(span.from); d <= span.to; d = addDays(d, 7)) weeks.set(d, 0);
  const newOnes = accounts.filter((a) => a.createdAt >= start && a.createdAt < end);
  for (const a of newOnes) {
    const w = weekStart(jakartaDate(a.createdAt));
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  const everPaid = new Set(payments.filter((p) => p.cancelledAt === null).map((p) => p.accountId));
  const mature = newOnes.filter((a) => now - a.createdAt >= 14 * DAY_MS);
  const churned = accounts.filter((a) => everPaid.has(a.id) && statusOf(a, now) === 'expired' && entitledUntil(a) >= start && entitledUntil(a) < end);
  return {
    signups: newOnes.length,
    signupsByWeek: [...weeks].map(([week, count]) => ({ week, count })),
    activeMerchants: perMerchant.filter((m) => m.transactions > 0).length,
    payingNow: accounts.filter((a) => statusOf(a, now) === 'paid').length,
    revenue: live.reduce((s, p) => s + p.amount, 0),
    paymentsCount: live.length,
    revenueByMonth: [...months].sort(([x], [y]) => x.localeCompare(y)).map(([month, total]) => ({ month, total })),
    conversion: { eligible: mature.length, converted: mature.filter((a) => everPaid.has(a.id)).length },
    churned: churned.length,
  };
}

export function merchantsReport(span: DateSpan, now: number, accounts: readonly AccountLite[], days: readonly DaySeriesRow[], perMerchant: readonly MerchantTotal[]) {
  const filled = fillDays(span, days);
  const totals = totalsOf(days);
  const email = new Map(accounts.map((a) => [a.id, a.email]));
  const top = [...perMerchant]
    .filter((m) => m.transactions > 0)
    .sort((x, y) => y.net - x.net)
    .slice(0, 10)
    .map((m) => ({ accountId: m.accountId, email: email.get(m.accountId) ?? '', transactions: m.transactions, net: m.net, share: totals.net > 0 ? m.net / totals.net : 0 }));
  const n = spanDays(span);
  const by = new Map(perMerchant.map((m) => [m.accountId, m]));
  const { end } = spanMs(span);
  const counted = accounts.filter((a) => a.createdAt < end && (statusOf(a, now) !== 'expired' || by.has(a.id)));
  const buckets = BUCKETS.map((key) => ({ key, count: 0 }));
  for (const a of counted) buckets[bucketOf((by.get(a.id)?.transactions ?? 0) / n)].count++;
  return { totals, byPay: payMix(days), days: filled, weekdays: weekdays(filled), top, buckets };
}

export interface ExecutiveReport {
  span: DateSpan;
  business: ReturnType<typeof businessReport>;
  merchants: ReturnType<typeof merchantsReport> & { byMode: NamedTotal[]; hours: { hour: number; transactions: number; gross: number }[] };
}

export async function adminReport(deps: Deps, auth: string | null, ctx: RequestCtx): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const span = readSpan(ctx, now);
  if (!span) return { status: 400, body: { error: 'invalid_range' } };
  const [accounts, payments, days, perMerchant, byMode, hours] = await Promise.all([
    deps.repo.allAccounts(),
    deps.repo.listPayments({ from: span.from, to: span.to, limit: 50_000 }),
    deps.repo.dailySeries(span),
    deps.repo.merchantTotals(span),
    deps.repo.modeTotals(span),
    deps.repo.hourTotals(span),
  ]);
  if (ctx.query.get('format') === 'csv') {
    const email = new Map(accounts.map((x) => [x.id, x.email]));
    const rows = [...perMerchant].sort((x, y) => y.net - x.net);
    const csv = toCsv([
      ['Email', 'Status', 'Hari aktif', 'Transaksi', 'Penjualan kotor', 'Refund', 'Penjualan bersih'],
      ...rows.map((m) => {
        const acc = accounts.find((x) => x.id === m.accountId);
        return [email.get(m.accountId) ?? '', acc ? statusOf(acc, now) : '', m.activeDays, m.transactions, m.gross, m.refunds, m.net];
      }),
    ]);
    return { status: 200, body: null, text: { contentType: 'text/csv; charset=utf-8', content: csv, filename: `laporan-merchant-${span.from}_${span.to}.csv` } };
  }
  const body: ExecutiveReport = {
    span,
    business: businessReport(span, now, accounts, payments, perMerchant),
    merchants: { ...merchantsReport(span, now, accounts, days, perMerchant), byMode, hours },
  };
  return { status: 200, body };
}

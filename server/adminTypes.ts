/** Types for the business console (ADR-020): payments ledger, grants, admin sessions, merchant daily totals, landing content. */
import type { Account } from './types';

export const PAYMENT_KINDS = ['transfer', 'qris', 'ewallet', 'cash', 'other'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** Payment types a merchant's sales are split by (same list as the app's PAYMENT_TYPES). */
export const SALE_PAY_TYPES = ['cash', 'qris', 'transfer', 'ewallet', 'other'] as const;
export type SalePayType = (typeof SALE_PAY_TYPES)[number];

/** A manual subscription payment Kenny records. Append-only: cancelling sets `cancelledAt`, never deletes. */
export interface Payment {
  id: string;
  accountId: string;
  planId: string | null;
  amount: number; // integer Rupiah
  days: number;
  method: PaymentKind;
  reference: string;
  paidOn: string; // YYYY-MM-DD (Asia/Jakarta)
  note: string;
  startsAt: number;
  endsAt: number;
  prevPaidUntil: number | null;
  recordedAt: number;
  recordedBy: string;
  cancelledAt: number | null;
  cancelReason: string | null;
}

/** Free trial days given by the operator. */
export interface Grant {
  id: string;
  accountId: string;
  days: number;
  reason: string;
  prevTrialEndsAt: number;
  newTrialEndsAt: number;
  at: number;
  by: string;
}

export interface AdminSession {
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface AccountLite extends Account {
  lastSeenAt: number | null;
}

export interface PaymentTotal {
  accountId: string;
  total: number;
  count: number;
  lastPlanId: string | null;
}

export interface TxTotals {
  transactions: number;
  gross: number;
  refunds: number;
}

/** One store's totals for one business date, sent by the app. Totals only: no receipts, items, customers or staff. */
export interface DailyRow {
  businessDate: string; // YYYY-MM-DD in the store's timezone and day cut-off
  transactions: number;
  gross: number;
  discounts: number;
  refunds: number;
  net: number;
  voidCount: number;
  voidAmount: number;
  itemsSold: number;
  pay: Record<SalePayType, TxTotals>;
  modes: (TxTotals & { name: string })[];
  hours: { transactions: number; gross: number }[]; // 24 entries, index = hour
  appVersion: string;
  computedAt: number;
}

export interface DaySeriesRow {
  date: string;
  merchants: number; // merchants with at least one transaction that day
  transactions: number;
  gross: number;
  refunds: number;
  net: number;
  discounts: number;
  voidCount: number;
  pay: Record<SalePayType, TxTotals>;
}

export interface NamedTotal extends TxTotals {
  name: string;
}

export interface MerchantTotal extends TxTotals {
  accountId: string;
  net: number;
  activeDays: number;
}

export interface DateSpan {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export interface ContentFeature {
  title: string;
  text: string;
  hidden: boolean;
}
export interface ContentFaq {
  q: string;
  a: string;
  hidden: boolean;
}
/** Landing page text Kenny edits (ADR-020). Plain text only; the landing script uses textContent. */
export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  features: ContentFeature[];
  faqs: ContentFaq[];
  contact: string;
  updatedAt: number;
}

export interface AdminRepo {
  touchLastSeen(accountId: string, at: number): Promise<void>;
  allAccounts(): Promise<AccountLite[]>;
  paymentTotals(): Promise<PaymentTotal[]>;
  /** Inserts the payment and sets accounts.paid_until = p.endsAt only if paid_until still equals `expectedPaidUntil`. */
  recordPayment(p: Payment, expectedPaidUntil: number | null): Promise<boolean>;
  /** Marks cancelled and sets paid_until = `newPaidUntil` only if it still equals `expectedPaidUntil`. */
  cancelPayment(id: string, at: number, reason: string, newPaidUntil: number | null, expectedPaidUntil: number | null): Promise<boolean>;
  findPayment(id: string): Promise<Payment | null>;
  listPayments(q: { from?: string; to?: string; accountId?: string; limit: number }): Promise<Payment[]>;
  /** Inserts the grant and sets trial_ends_at = g.newTrialEndsAt only if it still equals g.prevTrialEndsAt. */
  recordGrant(g: Grant): Promise<boolean>;
  listGrants(accountId: string): Promise<Grant[]>;

  putAdminSession(s: AdminSession): Promise<void>;
  findAdminSession(tokenHash: string): Promise<AdminSession | null>;
  deleteAdminSession(tokenHash: string): Promise<void>;
  countRate(key: string, since: number): Promise<number>;
  addRate(key: string, at: number): Promise<void>;

  upsertDaily(accountId: string, rows: DailyRow[], receivedAt: number): Promise<void>;
  dailySeries(span: DateSpan, accountId?: string): Promise<DaySeriesRow[]>;
  modeTotals(span: DateSpan, accountId?: string): Promise<NamedTotal[]>;
  hourTotals(span: DateSpan, accountId?: string): Promise<{ hour: number; transactions: number; gross: number }[]>;
  merchantTotals(span: DateSpan): Promise<MerchantTotal[]>;

  getContent(): Promise<SiteContent | null>;
  putContent(c: SiteContent): Promise<void>;
}

export const emptyPay = (): Record<SalePayType, TxTotals> =>
  Object.fromEntries(SALE_PAY_TYPES.map((k) => [k, { transactions: 0, gross: 0, refunds: 0 }])) as Record<SalePayType, TxTotals>;

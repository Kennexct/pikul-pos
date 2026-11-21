import { PAYMENT_KINDS, type AccountLite, type Grant, type Payment, type PaymentKind } from './adminTypes';
import { entitledUntil, planOf } from './auth';
import type { Checked } from './catalog';
import { DAY_MS, type Account, type PlanDef } from './types';

/** Pure rules for the manual payments ledger and trial grants (ADR-020). */

export const JAKARTA_MS = 7 * 3_600_000;
/** Calendar date in Asia/Jakarta (the console's "today"). */
export const jakartaDate = (ms: number) => new Date(ms + JAKARTA_MS).toISOString().slice(0, 10);
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const isDate = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v) && jakartaDate(Date.parse(`${v}T00:00:00+07:00`)) === v;

const fail = <T>(error: string): Checked<T> => ({ ok: false, error });
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);
function line(v: unknown, max: number, required = false): string | null {
  if (v === undefined || v === null) return required ? null : '';
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length > max || /[\u0000-\u001f\u007f]/.test(s)) return null;
  if (required && !s) return null;
  return s;
}

export interface PaymentInput {
  planId: string | null;
  amount: number;
  days: number;
  method: PaymentKind;
  reference: string;
  paidOn: string;
  note: string;
}

export const MAX_PAYMENT = 1_000_000_000;

export function checkPaymentInput(body: unknown, account: Account, plans: readonly PlanDef[], now: number): Checked<PaymentInput> {
  const f = (body ?? {}) as Record<string, unknown>;
  let planId: string | null = null;
  if (f.planId !== null && f.planId !== undefined && f.planId !== '') {
    const plan = plans.find((p) => p.id === f.planId);
    if (!plan) return fail('invalid_plan');
    planId = plan.id;
  }
  const amount = int(f.amount, 0, MAX_PAYMENT);
  if (amount === null) return fail('invalid_payment_amount');
  const days = int(f.days, 1, 1_095);
  if (days === null) return fail('invalid_days');
  if (typeof f.method !== 'string' || !(PAYMENT_KINDS as readonly string[]).includes(f.method)) return fail('invalid_method');
  const reference = line(f.reference, 80);
  const note = line(f.note, 200);
  if (reference === null || note === null) return fail('invalid_text');
  if (!isDate(f.paidOn) || f.paidOn > jakartaDate(now) || f.paidOn < jakartaDate(account.createdAt)) return fail('invalid_paid_on');
  return { ok: true, value: { planId, amount, days, method: f.method as PaymentKind, reference, paidOn: f.paidOn, note } };
}

/** New days start at the later of now, the trial end and the current paid end: no trial or paid day is lost. */
export const extendBase = (a: Account, now: number) => Math.max(now, a.trialEndsAt, a.paidUntil ?? 0);

export function buildPayment(input: PaymentInput, account: Account, now: number, id: string, actor: string): Payment {
  const startsAt = extendBase(account, now);
  return {
    id,
    accountId: account.id,
    ...input,
    startsAt,
    endsAt: startsAt + input.days * DAY_MS,
    prevPaidUntil: account.paidUntil,
    recordedAt: now,
    recordedBy: actor,
    cancelledAt: null,
    cancelReason: null,
  };
}

/**
 * paid_until after cancelling `p`: its days come off the current end. With no other live payment the account goes
 * back to its trial (null); otherwise never earlier than the trial end.
 */
export function paidUntilAfterCancel(p: Payment, account: Account, accountPayments: readonly Payment[]): number | null {
  const others = accountPayments.filter((x) => x.cancelledAt === null && x.id !== p.id);
  if (others.length === 0 || account.paidUntil === null) return null;
  return Math.max(account.trialEndsAt, account.paidUntil - p.days * DAY_MS);
}

export function checkGrantInput(body: unknown): Checked<{ days: number; reason: string }> {
  const f = (body ?? {}) as Record<string, unknown>;
  const days = int(f.days, 1, 60);
  if (days === null) return fail('invalid_grant_days');
  const reason = line(f.reason, 200, true);
  if (reason === null) return fail('invalid_reason');
  return { ok: true, value: { days, reason } };
}

export function buildGrant(account: Account, days: number, reason: string, now: number, id: string, actor: string): Grant {
  return { id, accountId: account.id, days, reason, prevTrialEndsAt: account.trialEndsAt, newTrialEndsAt: Math.max(now, account.trialEndsAt) + days * DAY_MS, at: now, by: actor };
}

// ---------- account status (shared by the list filters, counts and follow-ups) ----------

export type MerchantStatus = 'trial' | 'paid' | 'expired';
export const ENDING_MS = 3 * DAY_MS;
export const INACTIVE_MS = 7 * DAY_MS;

export const statusOf = (a: Account, now: number): MerchantStatus => (entitledUntil(a) <= now ? 'expired' : planOf(a));
export const isEnding = (a: Account, now: number, within = ENDING_MS) => statusOf(a, now) !== 'expired' && entitledUntil(a) - now <= within;
export const isLapsed = (a: Account, now: number) => statusOf(a, now) === 'expired' && now - entitledUntil(a) <= INACTIVE_MS;
export const isInactive = (a: AccountLite, now: number) => now - (a.lastSeenAt ?? a.createdAt) > INACTIVE_MS;

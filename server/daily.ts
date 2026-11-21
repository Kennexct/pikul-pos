import { emptyPay, SALE_PAY_TYPES, type DailyRow, type TxTotals } from './adminTypes';
import { accountFromBearer } from './auth';
import type { Checked } from './catalog';
import { isDate, jakartaDate } from './ledger';
import { DAY_MS, type ApiResponse, type Deps } from './types';

/** Daily sales totals sent by the merchant app (ADR-020). Totals only; validated strictly, written only to the sender's account. */

export const MAX_DAILY_ROWS = 35;
export const MAX_DAILY_POSTS_PER_HOUR = 120;
export const DAILY_BODY_LIMIT = 65_536;
const BIG = 1e12;
const fail = <T>(error: string): Checked<T> => ({ ok: false, error });
const int = (v: unknown, max = BIG) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null);

function tx(v: unknown): TxTotals | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const transactions = int(o.transactions, 1e7);
  const gross = int(o.gross);
  const refunds = int(o.refunds);
  return transactions === null || gross === null || refunds === null ? null : { transactions, gross, refunds };
}

function row(v: unknown, appVersion: string, now: number): DailyRow | null {
  const o = (v ?? {}) as Record<string, unknown>;
  if (!isDate(o.businessDate) || o.businessDate < jakartaDate(now - 400 * DAY_MS) || o.businessDate > jakartaDate(now + DAY_MS)) return null;
  const transactions = int(o.transactions);
  const gross = int(o.gross);
  const discounts = int(o.discounts);
  const refunds = int(o.refunds);
  const voidCount = int(o.voidCount);
  const voidAmount = int(o.voidAmount);
  // net can be negative: a refund counts on its own day (ADR-002), possibly a day with fewer sales.
  const net = typeof o.net === 'number' && Number.isInteger(o.net) && Math.abs(o.net) <= BIG ? o.net : null;
  if (transactions === null || gross === null || discounts === null || refunds === null || voidCount === null || voidAmount === null || net === null) return null;
  const itemsSold = typeof o.itemsSold === 'number' && Number.isFinite(o.itemsSold) && o.itemsSold >= 0 && o.itemsSold <= 1e9 ? Math.round(o.itemsSold * 1000) / 1000 : null;
  const computedAt = int(o.computedAt, now + DAY_MS);
  if (itemsSold === null || computedAt === null) return null;
  const pay = emptyPay();
  const payIn = (o.pay ?? {}) as Record<string, unknown>;
  for (const k of SALE_PAY_TYPES) {
    if (payIn[k] === undefined) continue;
    const t = tx(payIn[k]);
    if (!t) return null;
    pay[k] = t;
  }
  if (!Array.isArray(o.modes) || o.modes.length > 12) return null;
  const modes: DailyRow['modes'] = [];
  for (const m of o.modes as Record<string, unknown>[]) {
    const t = tx(m);
    const name = typeof m?.name === 'string' ? m.name.trim() : '';
    if (!t || !name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) return null;
    modes.push({ name, ...t });
  }
  if (!Array.isArray(o.hours) || o.hours.length !== 24) return null;
  const hours: DailyRow['hours'] = [];
  for (const h of o.hours as Record<string, unknown>[]) {
    const transactions = int(h?.transactions, 1e7);
    const g = int(h?.gross);
    if (transactions === null || g === null) return null;
    hours.push({ transactions, gross: g });
  }
  return { businessDate: o.businessDate, transactions, gross, discounts, refunds, net, voidCount, voidAmount, itemsSold, pay, modes, hours, appVersion, computedAt };
}

export function checkDaily(body: unknown, now: number): Checked<DailyRow[]> {
  const b = (body ?? {}) as Record<string, unknown>;
  const appVersion = typeof b.appVersion === 'string' && /^[0-9A-Za-z.+-]{1,20}$/.test(b.appVersion) ? b.appVersion : null;
  if (!appVersion) return fail('invalid_version');
  if (!Array.isArray(b.rows) || b.rows.length === 0 || b.rows.length > MAX_DAILY_ROWS) return fail('invalid_rows');
  const rows: DailyRow[] = [];
  for (const r of b.rows) {
    const ok = row(r, appVersion, now);
    if (!ok) return fail('invalid_row');
    rows.push(ok);
  }
  if (new Set(rows.map((r) => r.businessDate)).size !== rows.length) return fail('duplicate_date');
  return { ok: true, value: rows };
}

/** POST /api/merchant/daily — Bearer = the merchant's refresh token (not rotated). */
export async function postDaily(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const account = await accountFromBearer(deps, auth);
  if (!account) return { status: 401, body: { error: 'signed_out' } };
  const now = deps.now();
  const key = `daily:${account.id}`;
  if ((await deps.repo.countRate(key, now - 3_600_000)) >= MAX_DAILY_POSTS_PER_HOUR) return { status: 429, body: { error: 'too_many' } };
  const checked = checkDaily(body, now);
  if (!checked.ok) return { status: 400, body: { error: checked.error } };
  await deps.repo.addRate(key, now);
  await deps.repo.upsertDaily(account.id, checked.value, now);
  return { status: 200, body: { ok: true, saved: checked.value.length } };
}

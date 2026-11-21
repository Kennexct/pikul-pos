import type { AccountLite, Payment, PaymentTotal } from './adminTypes';
import { isResponse, requireAdmin } from './adminAuth';
import { entitledUntil } from './auth';
import { offers } from './catalog';
import { toCsv } from './csv';
import { buildGrant, buildPayment, checkGrantInput, checkPaymentInput, isEnding, isInactive, isLapsed, jakartaDate, paidUntilAfterCancel, statusOf } from './ledger';
import { DAY_MS, type ApiResponse, type Deps, type PlanDef, type RequestCtx } from './types';

/** Business console: merchants, payments, grants, home overview (ADR-020). Summaries only; no merchant data beyond the account. */

const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });
const ok = (body: unknown): ApiResponse => ({ status: 200, body });
export const PAGE_SIZE = 50;
export const FILTERS = ['all', 'trial', 'paid', 'ending', 'expired', 'inactive'] as const;
type Filter = (typeof FILTERS)[number];

const daysBack = (now: number, days: number) => ({ from: jakartaDate(now - (days - 1) * DAY_MS), to: jakartaDate(now) });

function accountView(a: AccountLite, now: number, totals: PaymentTotal | undefined, plans: readonly PlanDef[], sales?: { transactions: number; net: number }) {
  const status = statusOf(a, now);
  const plan = totals?.lastPlanId ? plans.find((p) => p.id === totals.lastPlanId) : undefined;
  return {
    id: a.id,
    email: a.email,
    createdAt: a.createdAt,
    status,
    planId: status === 'paid' ? (totals?.lastPlanId ?? null) : null,
    planName: status === 'paid' ? (plan?.name ?? null) : null,
    until: entitledUntil(a),
    trialEndsAt: a.trialEndsAt,
    paidUntil: a.paidUntil,
    lastSeenAt: a.lastSeenAt,
    totalPaid: totals?.total ?? 0,
    paymentCount: totals?.count ?? 0,
    ending: isEnding(a, now),
    inactive: isInactive(a, now),
    tx30: sales?.transactions ?? 0,
    net30: sales?.net ?? 0,
  };
}
export type AccountView = ReturnType<typeof accountView>;

async function loadAll(deps: Deps, now: number) {
  const [accounts, totals, plans, sales] = await Promise.all([deps.repo.allAccounts(), deps.repo.paymentTotals(), deps.repo.listPlans(), deps.repo.merchantTotals(daysBack(now, 30))]);
  const byTotals = new Map(totals.map((t) => [t.accountId, t]));
  const bySales = new Map(sales.map((s) => [s.accountId, s]));
  const views = accounts.map((a) => accountView(a, now, byTotals.get(a.id), plans, bySales.get(a.id)));
  return { accounts, views, plans };
}

const matches = (v: AccountView, f: Filter) =>
  f === 'all' || (f === 'ending' ? v.ending : f === 'inactive' ? v.inactive && v.status !== 'expired' : v.status === f);

/** Counts per plan for "Paket merchant": trial, each paid plan, paid without a recorded plan, expired. */
function planCounts(views: readonly AccountView[], plans: readonly PlanDef[]) {
  const trial = { key: 'trial', label: null, count: 0 };
  const out: { key: string; label: string | null; count: number }[] = [trial];
  for (const p of [...plans].sort((a, b) => a.sort - b.sort)) out.push({ key: p.id, label: p.name, count: 0 });
  const other = { key: 'paid', label: null, count: 0 };
  const expired = { key: 'expired', label: null, count: 0 };
  for (const v of views) {
    if (v.status === 'trial') trial.count++;
    else if (v.status === 'expired') expired.count++;
    else {
      const row = v.planId ? out.find((o) => o.key === v.planId) : undefined;
      if (row) row.count++;
      else other.count++;
    }
  }
  return [...out, ...(other.count ? [other] : []), expired];
}

export async function adminMerchants(deps: Deps, auth: string | null, ctx: RequestCtx): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const { views, plans } = await loadAll(deps, now);
  const q = (ctx.query.get('q') ?? '').trim().toLowerCase().slice(0, 100);
  const filter = (FILTERS as readonly string[]).includes(ctx.query.get('filter') ?? '') ? (ctx.query.get('filter') as Filter) : 'all';
  const plan = ctx.query.get('plan') ?? '';
  const page = Math.max(0, Math.min(10_000, Number.parseInt(ctx.query.get('page') ?? '0', 10) || 0));
  const hits = views
    .filter((v) => (!q || v.email.includes(q)) && matches(v, filter))
    .filter((v) => !plan || (plan === 'trial' || plan === 'expired' ? v.status === plan : plan === 'paid' ? v.status === 'paid' && !v.planId : v.status === 'paid' && v.planId === plan))
    .sort((x, y) => y.createdAt - x.createdAt);
  return ok({ now, total: hits.length, page, pageSize: PAGE_SIZE, rows: hits.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), plans: planCounts(views, plans) });
}

export async function adminMerchant(deps: Deps, auth: string | null, id: string): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const { views, accounts } = await loadAll(deps, now);
  const view = views.find((v) => v.id === id);
  if (!view || !accounts.some((x) => x.id === id)) return bad('not_found', 404);
  const [payments, grants, plans, campaigns] = await Promise.all([deps.repo.listPayments({ accountId: id, limit: 200 }), deps.repo.listGrants(id), deps.repo.listPlans(), deps.repo.listCampaigns()]);
  return ok({ now, merchant: view, payments, grants, offers: offers(plans, campaigns, now), today: jakartaDate(now) });
}

export async function adminRecordPayment(deps: Deps, auth: string | null, accountId: string, body: unknown): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const account = await deps.repo.findAccountById(accountId);
  if (!account) return bad('not_found', 404);
  const now = deps.now();
  const checked = checkPaymentInput(body, account, await deps.repo.listPlans(), now);
  if (!checked.ok) return bad(checked.error);
  const p = buildPayment(checked.value, account, now, crypto.randomUUID(), a.actor);
  if (!(await deps.repo.recordPayment(p, account.paidUntil))) return bad('conflict', 409);
  await deps.repo.addAudit({ at: now, email: a.actor, action: 'payment.record', target: p.id, detail: p });
  return ok({ payment: p });
}

export async function adminCancelPayment(deps: Deps, auth: string | null, id: string, body: unknown): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const reason = typeof (body as { reason?: unknown })?.reason === 'string' ? (body as { reason: string }).reason.trim() : '';
  if (!reason || reason.length > 200 || /[\u0000-\u001f\u007f]/.test(reason)) return bad('invalid_reason');
  const p = await deps.repo.findPayment(id);
  if (!p) return bad('not_found', 404);
  if (p.cancelledAt !== null) return bad('already_cancelled', 409);
  const account = await deps.repo.findAccountById(p.accountId);
  if (!account) return bad('not_found', 404);
  const all = await deps.repo.listPayments({ accountId: p.accountId, limit: 1_000 });
  const next = paidUntilAfterCancel(p, account, all);
  const now = deps.now();
  if (!(await deps.repo.cancelPayment(id, now, reason, next, account.paidUntil))) return bad('conflict', 409);
  await deps.repo.addAudit({ at: now, email: a.actor, action: 'payment.cancel', target: id, detail: { reason, paidUntil: { from: account.paidUntil, to: next } } });
  return ok({ ok: true, paidUntil: next });
}

export async function adminGrant(deps: Deps, auth: string | null, accountId: string, body: unknown): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const checked = checkGrantInput(body);
  if (!checked.ok) return bad(checked.error);
  const account = await deps.repo.findAccountById(accountId);
  if (!account) return bad('not_found', 404);
  const now = deps.now();
  const g = buildGrant(account, checked.value.days, checked.value.reason, now, crypto.randomUUID(), a.actor);
  if (!(await deps.repo.recordGrant(g))) return bad('conflict', 409);
  await deps.repo.addAudit({ at: now, email: a.actor, action: 'trial.grant', target: accountId, detail: g });
  return ok({ grant: g });
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthSpan = (m: string) => {
  const [y = 0, mo = 1] = m.split('-').map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
};
export const prevMonth = (m: string) => {
  const [y = 0, mo = 1] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
};
const received = (ps: readonly Payment[]) => ps.filter((p) => p.cancelledAt === null).reduce((s, p) => s + p.amount, 0);

export async function adminPayments(deps: Deps, auth: string | null, ctx: RequestCtx): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const month = ctx.query.get('month') ?? jakartaDate(now).slice(0, 7);
  if (!MONTH_RE.test(month)) return bad('invalid_month');
  const [list, accounts, plans] = await Promise.all([deps.repo.listPayments({ ...monthSpan(month), limit: 5_000 }), deps.repo.allAccounts(), deps.repo.listPlans()]);
  const email = new Map(accounts.map((x) => [x.id, x.email]));
  const planName = new Map(plans.map((p) => [p.id, p.name]));
  const rows = list.map((p) => ({ ...p, email: email.get(p.accountId) ?? '', planName: p.planId ? (planName.get(p.planId) ?? p.planId) : null }));
  if (ctx.query.get('format') === 'csv') {
    const csv = toCsv([
      ['Tanggal bayar', 'Email', 'Paket', 'Jumlah', 'Hari', 'Metode', 'Referensi', 'Catatan', 'Aktif sampai', 'Dicatat', 'Dibatalkan', 'Alasan batal'],
      ...rows.map((r) => [r.paidOn, r.email, r.planName, r.amount, r.days, r.method, r.reference, r.note, jakartaDate(r.endsAt), new Date(r.recordedAt).toISOString(), r.cancelledAt ? new Date(r.cancelledAt).toISOString() : null, r.cancelReason]),
    ]);
    return { status: 200, body: null, text: { contentType: 'text/csv; charset=utf-8', content: csv, filename: `pembayaran-pikul-${month}.csv` } };
  }
  return ok({ month, rows, total: received(list), count: list.filter((p) => p.cancelledAt === null).length, cancelled: list.filter((p) => p.cancelledAt !== null).length });
}

/** Home screen: counts, follow-ups, money received, and (once merchants send totals) sales today / 7 days. */
export async function adminOverview(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const { views, accounts, plans } = await loadAll(deps, now);
  const month = jakartaDate(now).slice(0, 7);
  const [thisMonth, lastMonth, today, week] = await Promise.all([
    deps.repo.listPayments({ ...monthSpan(month), limit: 5_000 }),
    deps.repo.listPayments({ ...monthSpan(prevMonth(month)), limit: 5_000 }),
    deps.repo.dailySeries(daysBack(now, 1)),
    deps.repo.merchantTotals(daysBack(now, 7)),
  ]);
  const mature = accounts.filter((x) => now - x.createdAt >= 14 * DAY_MS);
  const paidIds = new Set(views.filter((v) => v.paymentCount > 0).map((v) => v.id));
  const count = (f: (v: AccountView) => boolean) => views.filter(f).length;
  const byId = new Map(accounts.map((x) => [x.id, x]));
  const follow = views
    .filter((v) => (v.status === 'trial' && v.ending) || (v.status === 'paid' && isEnding(byId.get(v.id)!, now, 7 * DAY_MS)) || isLapsed(byId.get(v.id)!, now))
    .map((v) => ({ ...v, reason: v.status === 'expired' ? ('lapsed' as const) : v.status === 'trial' ? ('trial_ending' as const) : ('paid_ending' as const) }))
    .sort((x, y) => x.until - y.until)
    .slice(0, 50);
  const activeWeek = new Set(week.filter((m) => m.transactions > 0).map((m) => m.accountId));
  const stopped = views.filter((v) => v.status !== 'expired' && now - v.createdAt >= 7 * DAY_MS && !activeWeek.has(v.id)).length;
  return ok({
    now,
    counts: {
      total: views.length,
      paid: count((v) => v.status === 'paid'),
      trial: count((v) => v.status === 'trial'),
      expired: count((v) => v.status === 'expired'),
      signups7: count((v) => now - v.createdAt < 7 * DAY_MS),
      signups30: count((v) => now - v.createdAt < 30 * DAY_MS),
    },
    conversion: { eligible: mature.length, converted: mature.filter((x) => paidIds.has(x.id)).length },
    revenue: { month, thisMonth: received(thisMonth), lastMonth: received(lastMonth) },
    sales: {
      today: { transactions: today.reduce((s, d) => s + d.transactions, 0), net: today.reduce((s, d) => s + d.net, 0), merchants: today.reduce((s, d) => s + d.merchants, 0) },
      week: { transactions: week.reduce((s, m) => s + m.transactions, 0), net: week.reduce((s, m) => s + m.net, 0), merchants: activeWeek.size },
      stopped,
    },
    plans: planCounts(views, plans),
    followUps: follow,
  });
}

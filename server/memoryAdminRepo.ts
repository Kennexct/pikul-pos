import { emptyPay, SALE_PAY_TYPES, type AdminRepo, type AdminSession, type DailyRow, type DateSpan, type DaySeriesRow, type Grant, type MerchantTotal, type NamedTotal, type Payment, type SiteContent } from './adminTypes';
import type { Account } from './types';

/** In-memory AdminRepo (tests, `wrangler pages dev` without a database). Same rules as the Neon queries. */
export function memoryAdminRepo(accounts: Map<string, Account>) {
  const lastSeen = new Map<string, number>();
  const payments = new Map<string, Payment>();
  const grants: Grant[] = [];
  const sessions = new Map<string, AdminSession>();
  const rates: { key: string; at: number }[] = [];
  const daily = new Map<string, DailyRow & { accountId: string }>();
  let content: SiteContent | null = null;
  const clone = <T>(v: T | undefined): T | null => (v ? structuredClone(v) : null);
  const inSpan = (d: string, s: DateSpan) => d >= s.from && d <= s.to;
  const rowsIn = (s: DateSpan, accountId?: string) => [...daily.values()].filter((r) => inSpan(r.businessDate, s) && (!accountId || r.accountId === accountId));

  const repo: AdminRepo = {
    async touchLastSeen(id, at) {
      lastSeen.set(id, at);
    },
    async allAccounts() {
      return [...accounts.values()].map((a) => ({ ...structuredClone(a), lastSeenAt: lastSeen.get(a.id) ?? null }));
    },
    async paymentTotals() {
      const by = new Map<string, { total: number; count: number; last: Payment }>();
      for (const p of payments.values()) {
        if (p.cancelledAt !== null) continue;
        const cur = by.get(p.accountId);
        if (!cur) by.set(p.accountId, { total: p.amount, count: 1, last: p });
        else {
          cur.total += p.amount;
          cur.count++;
          if (p.recordedAt >= cur.last.recordedAt) cur.last = p;
        }
      }
      return [...by].map(([accountId, v]) => ({ accountId, total: v.total, count: v.count, lastPlanId: v.last.planId }));
    },
    async recordPayment(p, expected) {
      const a = accounts.get(p.accountId);
      if (!a || a.paidUntil !== expected) return false;
      a.paidUntil = p.endsAt;
      payments.set(p.id, structuredClone(p));
      return true;
    },
    async cancelPayment(id, at, reason, newPaidUntil, expected) {
      const p = payments.get(id);
      const a = p ? accounts.get(p.accountId) : undefined;
      if (!p || !a || p.cancelledAt !== null || a.paidUntil !== expected) return false;
      p.cancelledAt = at;
      p.cancelReason = reason;
      a.paidUntil = newPaidUntil;
      return true;
    },
    async findPayment(id) {
      return clone(payments.get(id));
    },
    async listPayments(q) {
      return [...payments.values()]
        .filter((p) => (!q.accountId || p.accountId === q.accountId) && (!q.from || p.paidOn >= q.from) && (!q.to || p.paidOn <= q.to))
        .sort((x, y) => y.paidOn.localeCompare(x.paidOn) || y.recordedAt - x.recordedAt)
        .slice(0, q.limit)
        .map((p) => structuredClone(p));
    },
    async recordGrant(g) {
      const a = accounts.get(g.accountId);
      if (!a || a.trialEndsAt !== g.prevTrialEndsAt) return false;
      a.trialEndsAt = g.newTrialEndsAt;
      grants.push(structuredClone(g));
      return true;
    },
    async listGrants(accountId) {
      return grants.filter((g) => g.accountId === accountId).sort((x, y) => y.at - x.at).map((g) => structuredClone(g));
    },
    async putAdminSession(s) {
      sessions.set(s.tokenHash, structuredClone(s));
    },
    async findAdminSession(h) {
      return clone(sessions.get(h));
    },
    async deleteAdminSession(h) {
      sessions.delete(h);
    },
    async countRate(key, since) {
      return rates.filter((r) => r.key === key && r.at >= since).length;
    },
    async addRate(key, at) {
      rates.push({ key, at });
    },
    async upsertDaily(accountId, rows) {
      for (const r of rows) {
        const k = `${accountId}|${r.businessDate}`;
        const prev = daily.get(k);
        if (!prev || prev.computedAt <= r.computedAt) daily.set(k, { ...structuredClone(r), accountId });
      }
    },
    async dailySeries(span, accountId) {
      const by = new Map<string, DaySeriesRow>();
      for (const r of rowsIn(span, accountId)) {
        const d = by.get(r.businessDate) ?? { date: r.businessDate, merchants: 0, transactions: 0, gross: 0, refunds: 0, net: 0, discounts: 0, voidCount: 0, pay: emptyPay() };
        if (r.transactions > 0) d.merchants++;
        d.transactions += r.transactions;
        d.gross += r.gross;
        d.refunds += r.refunds;
        d.net += r.net;
        d.discounts += r.discounts;
        d.voidCount += r.voidCount;
        for (const k of SALE_PAY_TYPES) {
          d.pay[k].transactions += r.pay[k].transactions;
          d.pay[k].gross += r.pay[k].gross;
          d.pay[k].refunds += r.pay[k].refunds;
        }
        by.set(r.businessDate, d);
      }
      return [...by.values()].sort((x, y) => x.date.localeCompare(y.date));
    },
    async modeTotals(span, accountId) {
      const by = new Map<string, NamedTotal>();
      for (const r of rowsIn(span, accountId))
        for (const m of r.modes) {
          const key = m.name.trim().toLowerCase();
          const cur = by.get(key) ?? { name: m.name.trim(), transactions: 0, gross: 0, refunds: 0 };
          cur.transactions += m.transactions;
          cur.gross += m.gross;
          cur.refunds += m.refunds;
          by.set(key, cur);
        }
      return [...by.values()].sort((x, y) => y.gross - x.gross);
    },
    async hourTotals(span, accountId) {
      const out = Array.from({ length: 24 }, (_, hour) => ({ hour, transactions: 0, gross: 0 }));
      for (const r of rowsIn(span, accountId))
        r.hours.forEach((h, i) => {
          if (!out[i]) return;
          out[i].transactions += h.transactions;
          out[i].gross += h.gross;
        });
      return out;
    },
    async merchantTotals(span) {
      const by = new Map<string, MerchantTotal>();
      for (const r of rowsIn(span)) {
        const m = by.get(r.accountId) ?? { accountId: r.accountId, transactions: 0, gross: 0, refunds: 0, net: 0, activeDays: 0 };
        m.transactions += r.transactions;
        m.gross += r.gross;
        m.refunds += r.refunds;
        m.net += r.net;
        if (r.transactions > 0) m.activeDays++;
        by.set(r.accountId, m);
      }
      return [...by.values()];
    },
    async getContent() {
      return content ? structuredClone(content) : null;
    },
    async putContent(c) {
      content = structuredClone(c);
    },
  };
  return { repo, payments, daily, sessions };
}

import type { NeonQueryFunction } from '@neondatabase/serverless';
import { emptyPay, SALE_PAY_TYPES, type AdminRepo, type AdminSession, type DaySeriesRow, type Grant, type Payment, type SiteContent } from './adminTypes';

type Row = Record<string, unknown>;
type Sql = NeonQueryFunction<false, false>;
const ms = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string).getTime());
const iso = (v: number | null) => (v === null ? null : new Date(v).toISOString());
const n = (v: unknown) => Number(v ?? 0);

const payment = (r: Row): Payment => ({
  id: r.id as string,
  accountId: r.account_id as string,
  planId: (r.plan_id as string | null) ?? null,
  amount: n(r.amount),
  days: n(r.days),
  method: r.method as Payment['method'],
  reference: r.reference as string,
  paidOn: r.paid_on as string,
  note: r.note as string,
  startsAt: ms(r.starts_at)!,
  endsAt: ms(r.ends_at)!,
  prevPaidUntil: ms(r.prev_paid_until),
  recordedAt: ms(r.recorded_at)!,
  recordedBy: r.recorded_by as string,
  cancelledAt: ms(r.cancelled_at),
  cancelReason: (r.cancel_reason as string | null) ?? null,
});
const grant = (r: Row): Grant => ({
  id: r.id as string,
  accountId: r.account_id as string,
  days: n(r.days),
  reason: r.reason as string,
  prevTrialEndsAt: ms(r.prev_trial_ends_at)!,
  newTrialEndsAt: ms(r.new_trial_ends_at)!,
  at: ms(r.at)!,
  by: r.by as string,
});
const PAYMENT_COLS = 'id, account_id, plan_id, amount, days, method, reference, paid_on::text as paid_on, note, starts_at, ends_at, prev_paid_until, recorded_at, recorded_by, cancelled_at, cancel_reason';

/** Neon queries for the business console (ADR-020). Conditional writes guard against two tabs changing one account at once. */
export function neonAdminRepo(sql: Sql): AdminRepo {
  const rows = (q: Promise<unknown>) => q as Promise<Row[]>;
  return {
    async touchLastSeen(id, at) {
      await sql`update accounts set last_seen_at = ${iso(at)} where id = ${id} and (last_seen_at is null or last_seen_at < ${iso(at - 600_000)})`;
    },
    async allAccounts() {
      return (await rows(sql`select * from accounts`)).map((r) => ({
        id: r.id as string,
        email: r.email as string,
        googleSub: (r.google_sub as string | null) ?? null,
        createdAt: ms(r.created_at)!,
        trialEndsAt: ms(r.trial_ends_at)!,
        paidUntil: ms(r.paid_until),
        ownerName: (r.owner_name as string | undefined) ?? '',
        storeName: (r.store_name as string | undefined) ?? '',
        phone: (r.phone as string | undefined) ?? '',
        city: (r.city as string | undefined) ?? '',
        lastSeenAt: ms(r.last_seen_at),
      }));
    },
    async paymentTotals() {
      const r = await rows(sql`select account_id, sum(amount) as total, count(*) as count,
          (array_agg(plan_id order by recorded_at desc))[1] as last_plan_id
        from payments where cancelled_at is null group by account_id`);
      return r.map((x) => ({ accountId: x.account_id as string, total: n(x.total), count: n(x.count), lastPlanId: (x.last_plan_id as string | null) ?? null }));
    },
    async recordPayment(p, expected) {
      const r = await rows(sql`with upd as (
          update accounts set paid_until = ${iso(p.endsAt)}
          where id = ${p.accountId} and paid_until is not distinct from ${iso(expected)}::timestamptz returning id)
        insert into payments (id, account_id, plan_id, amount, days, method, reference, paid_on, note, starts_at, ends_at, prev_paid_until, recorded_at, recorded_by)
        select ${p.id}, ${p.accountId}, ${p.planId}, ${p.amount}, ${p.days}, ${p.method}, ${p.reference}, ${p.paidOn}::date, ${p.note},
          ${iso(p.startsAt)}, ${iso(p.endsAt)}, ${iso(p.prevPaidUntil)}, ${iso(p.recordedAt)}, ${p.recordedBy} from upd
        returning id`);
      return r.length === 1;
    },
    async cancelPayment(id, at, reason, newPaidUntil, expected) {
      const r = await rows(sql`with upd as (
          update accounts a set paid_until = ${iso(newPaidUntil)} from payments p
          where p.id = ${id} and p.cancelled_at is null and a.id = p.account_id and a.paid_until is not distinct from ${iso(expected)}::timestamptz
          returning p.id)
        update payments set cancelled_at = ${iso(at)}, cancel_reason = ${reason} where id in (select id from upd) returning id`);
      return r.length === 1;
    },
    async findPayment(id) {
      const [r] = await rows(sql.query(`select ${PAYMENT_COLS} from payments where id = $1`, [id]));
      return r ? payment(r) : null;
    },
    async listPayments(q) {
      const r = await rows(
        sql.query(
          `select ${PAYMENT_COLS} from payments
           where ($1::uuid is null or account_id = $1) and ($2::date is null or paid_on >= $2) and ($3::date is null or paid_on <= $3)
           order by paid_on desc, recorded_at desc limit $4`,
          [q.accountId ?? null, q.from ?? null, q.to ?? null, q.limit],
        ),
      );
      return r.map(payment);
    },
    async recordGrant(g) {
      const r = await rows(sql`with upd as (
          update accounts set trial_ends_at = ${iso(g.newTrialEndsAt)} where id = ${g.accountId} and trial_ends_at = ${iso(g.prevTrialEndsAt)}::timestamptz returning id)
        insert into account_grants (id, account_id, days, reason, prev_trial_ends_at, new_trial_ends_at, at, by)
        select ${g.id}, ${g.accountId}, ${g.days}, ${g.reason}, ${iso(g.prevTrialEndsAt)}, ${iso(g.newTrialEndsAt)}, ${iso(g.at)}, ${g.by} from upd returning id`);
      return r.length === 1;
    },
    async listGrants(accountId) {
      return (await rows(sql`select * from account_grants where account_id = ${accountId} order by at desc limit 100`)).map(grant);
    },
    async putAdminSession(s) {
      await sql`insert into admin_sessions (token_hash, created_at, expires_at) values (${s.tokenHash}, ${iso(s.createdAt)}, ${iso(s.expiresAt)})`;
      await sql`delete from admin_sessions where expires_at < ${iso(s.createdAt)}`;
    },
    async findAdminSession(h) {
      const [r] = await rows(sql`select * from admin_sessions where token_hash = ${h}`);
      return r ? ({ tokenHash: r.token_hash as string, createdAt: ms(r.created_at)!, expiresAt: ms(r.expires_at)! } satisfies AdminSession) : null;
    },
    async deleteAdminSession(h) {
      await sql`delete from admin_sessions where token_hash = ${h}`;
    },
    async countRate(key, since) {
      const [r] = await rows(sql`select count(*) as c from rate_events where key = ${key} and at >= ${iso(since)}`);
      return n(r?.c);
    },
    async addRate(key, at) {
      await sql`insert into rate_events (key, at) values (${key}, ${iso(at)})`;
      if (Math.random() < 0.02) await sql`delete from rate_events where at < ${iso(at - 86_400_000)}`;
    },
    async upsertDaily(accountId, list, receivedAt) {
      if (list.length === 0) return;
      await sql.transaction(
        list.map(
          (d) => sql`insert into merchant_daily (account_id, business_date, transactions, gross, discounts, refunds, net, void_count, void_amount, items_sold,
              cash_tx, cash_gross, cash_refunds, qris_tx, qris_gross, qris_refunds, transfer_tx, transfer_gross, transfer_refunds,
              ewallet_tx, ewallet_gross, ewallet_refunds, other_tx, other_gross, other_refunds, modes, hours, app_version, computed_at, received_at)
            values (${accountId}, ${d.businessDate}::date, ${d.transactions}, ${d.gross}, ${d.discounts}, ${d.refunds}, ${d.net}, ${d.voidCount}, ${d.voidAmount}, ${d.itemsSold},
              ${d.pay.cash.transactions}, ${d.pay.cash.gross}, ${d.pay.cash.refunds}, ${d.pay.qris.transactions}, ${d.pay.qris.gross}, ${d.pay.qris.refunds},
              ${d.pay.transfer.transactions}, ${d.pay.transfer.gross}, ${d.pay.transfer.refunds}, ${d.pay.ewallet.transactions}, ${d.pay.ewallet.gross}, ${d.pay.ewallet.refunds},
              ${d.pay.other.transactions}, ${d.pay.other.gross}, ${d.pay.other.refunds}, ${JSON.stringify(d.modes)}::jsonb, ${JSON.stringify(d.hours)}::jsonb,
              ${d.appVersion}, ${iso(d.computedAt)}, ${iso(receivedAt)})
            on conflict (account_id, business_date) do update set transactions = excluded.transactions, gross = excluded.gross, discounts = excluded.discounts,
              refunds = excluded.refunds, net = excluded.net, void_count = excluded.void_count, void_amount = excluded.void_amount, items_sold = excluded.items_sold,
              cash_tx = excluded.cash_tx, cash_gross = excluded.cash_gross, cash_refunds = excluded.cash_refunds,
              qris_tx = excluded.qris_tx, qris_gross = excluded.qris_gross, qris_refunds = excluded.qris_refunds,
              transfer_tx = excluded.transfer_tx, transfer_gross = excluded.transfer_gross, transfer_refunds = excluded.transfer_refunds,
              ewallet_tx = excluded.ewallet_tx, ewallet_gross = excluded.ewallet_gross, ewallet_refunds = excluded.ewallet_refunds,
              other_tx = excluded.other_tx, other_gross = excluded.other_gross, other_refunds = excluded.other_refunds,
              modes = excluded.modes, hours = excluded.hours, app_version = excluded.app_version, computed_at = excluded.computed_at, received_at = excluded.received_at
            where merchant_daily.computed_at <= excluded.computed_at`,
        ),
      );
    },
    async dailySeries(span, accountId) {
      const r = await rows(sql`select business_date::text as date, count(*) filter (where transactions > 0) as merchants,
          sum(transactions) as transactions, sum(gross) as gross, sum(refunds) as refunds, sum(net) as net, sum(discounts) as discounts, sum(void_count) as void_count,
          sum(cash_tx) as cash_tx, sum(cash_gross) as cash_gross, sum(cash_refunds) as cash_refunds,
          sum(qris_tx) as qris_tx, sum(qris_gross) as qris_gross, sum(qris_refunds) as qris_refunds,
          sum(transfer_tx) as transfer_tx, sum(transfer_gross) as transfer_gross, sum(transfer_refunds) as transfer_refunds,
          sum(ewallet_tx) as ewallet_tx, sum(ewallet_gross) as ewallet_gross, sum(ewallet_refunds) as ewallet_refunds,
          sum(other_tx) as other_tx, sum(other_gross) as other_gross, sum(other_refunds) as other_refunds
        from merchant_daily
        where business_date between ${span.from}::date and ${span.to}::date and (${accountId ?? null}::uuid is null or account_id = ${accountId ?? null}::uuid)
        group by business_date order by business_date`);
      return r.map((x): DaySeriesRow => {
        const pay = emptyPay();
        for (const k of SALE_PAY_TYPES) pay[k] = { transactions: n(x[`${k}_tx`]), gross: n(x[`${k}_gross`]), refunds: n(x[`${k}_refunds`]) };
        return { date: x.date as string, merchants: n(x.merchants), transactions: n(x.transactions), gross: n(x.gross), refunds: n(x.refunds), net: n(x.net), discounts: n(x.discounts), voidCount: n(x.void_count), pay };
      });
    },
    async modeTotals(span, accountId) {
      const r = await rows(sql`select min(trim(m->>'name')) as name, sum((m->>'transactions')::bigint) as transactions,
          sum((m->>'gross')::bigint) as gross, sum((m->>'refunds')::bigint) as refunds
        from merchant_daily d cross join lateral jsonb_array_elements(d.modes) as m
        where d.business_date between ${span.from}::date and ${span.to}::date and (${accountId ?? null}::uuid is null or d.account_id = ${accountId ?? null}::uuid)
        group by lower(trim(m->>'name')) order by gross desc limit 50`);
      return r.map((x) => ({ name: x.name as string, transactions: n(x.transactions), gross: n(x.gross), refunds: n(x.refunds) }));
    },
    async hourTotals(span, accountId) {
      const r = await rows(sql`select (h.idx - 1)::int as hour, sum((h.v->>'transactions')::bigint) as transactions, sum((h.v->>'gross')::bigint) as gross
        from merchant_daily d cross join lateral jsonb_array_elements(d.hours) with ordinality as h(v, idx)
        where d.business_date between ${span.from}::date and ${span.to}::date and (${accountId ?? null}::uuid is null or d.account_id = ${accountId ?? null}::uuid)
        group by h.idx`);
      const out = Array.from({ length: 24 }, (_, hour) => ({ hour, transactions: 0, gross: 0 }));
      for (const x of r) if (out[n(x.hour)]) out[n(x.hour)] = { hour: n(x.hour), transactions: n(x.transactions), gross: n(x.gross) };
      return out;
    },
    async merchantTotals(span) {
      const r = await rows(sql`select account_id, sum(transactions) as transactions, sum(gross) as gross, sum(refunds) as refunds, sum(net) as net,
          count(*) filter (where transactions > 0) as active_days
        from merchant_daily where business_date between ${span.from}::date and ${span.to}::date group by account_id`);
      return r.map((x) => ({ accountId: x.account_id as string, transactions: n(x.transactions), gross: n(x.gross), refunds: n(x.refunds), net: n(x.net), activeDays: n(x.active_days) }));
    },
    async getContent() {
      const [r] = await rows(sql`select content, updated_at from site_content where id = 1`);
      return r ? ({ ...(r.content as Omit<SiteContent, 'updatedAt'>), updatedAt: ms(r.updated_at)! } satisfies SiteContent) : null;
    },
    async putContent(c) {
      const { updatedAt, ...content } = c;
      await sql`insert into site_content (id, content, updated_at) values (1, ${JSON.stringify(content)}::jsonb, ${iso(updatedAt)})
        on conflict (id) do update set content = excluded.content, updated_at = excluded.updated_at`;
    },
  };
}

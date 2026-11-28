import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { ReceiptDoc, ReceiptRepo, ReceiptShare } from './receiptTypes';

type Row = Record<string, unknown>;
type Sql = NeonQueryFunction<false, false>;
const ms = (v: unknown) => new Date(v as string).getTime();
const iso = (v: number) => new Date(v).toISOString();
const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Neon storage for shared receipts (migration 007). */
export function neonReceiptRepo(sql: Sql): ReceiptRepo {
  return {
    async getReceiptShare(token) {
      const [r] = (await sql`select * from receipt_shares where token = ${token}`) as Row[];
      if (!r) return null;
      return {
        token: r.token as string,
        accountId: r.account_id as string,
        orderId: r.order_id as string,
        doc: (typeof r.doc === 'string' ? JSON.parse(r.doc) : r.doc) as ReceiptDoc,
        image: Uint8Array.from(atob(r.image_b64 as string), (c) => c.charCodeAt(0)),
        createdAt: ms(r.created_at),
        updatedAt: ms(r.updated_at),
        expiresAt: ms(r.expires_at),
      };
    },
    async putReceiptShare(s) {
      const r = (await sql`insert into receipt_shares (token, account_id, order_id, doc, image_b64, created_at, updated_at, expires_at)
        values (${s.token}, ${s.accountId}, ${s.orderId}, ${JSON.stringify(s.doc)}::jsonb, ${b64(s.image)}, ${iso(s.createdAt)}, ${iso(s.updatedAt)}, ${iso(s.expiresAt)})
        on conflict (token) do update set doc = excluded.doc, image_b64 = excluded.image_b64, updated_at = excluded.updated_at
        where receipt_shares.account_id = excluded.account_id and receipt_shares.order_id = excluded.order_id
        returning token`) as Row[];
      return r.length > 0;
    },
    async deleteExpiredReceiptShares(now) {
      const r = (await sql`delete from receipt_shares where expires_at < ${iso(now)} returning token`) as Row[];
      return r.length;
    },
  };
}

/** In-memory version for tests and local dev. */
export function memoryReceiptRepo(): ReceiptRepo & { shares: Map<string, ReceiptShare> } {
  const shares = new Map<string, ReceiptShare>();
  return {
    shares,
    async getReceiptShare(token) {
      const s = shares.get(token);
      return s ? structuredClone(s) : null;
    },
    async putReceiptShare(s) {
      const old = shares.get(s.token);
      if (old && (old.accountId !== s.accountId || old.orderId !== s.orderId)) return false;
      shares.set(s.token, structuredClone(old ? { ...s, createdAt: old.createdAt, expiresAt: old.expiresAt } : s));
      return true;
    },
    async deleteExpiredReceiptShares(now) {
      let n = 0;
      for (const [k, s] of shares) if (s.expiresAt < now && shares.delete(k)) n++;
      return n;
    },
  };
}

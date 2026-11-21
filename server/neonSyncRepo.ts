import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { SyncDevice, SyncHead, SyncRepo, SyncTableName } from './syncTypes';

type Row = Record<string, unknown>;
type Sql = NeonQueryFunction<false, false>;
const ms = (v: unknown) => new Date(v as string).getTime();
const iso = (v: number) => new Date(v).toISOString();

const device = (r: Row): SyncDevice => ({
  deviceId: r.device_id as string,
  name: r.name as string,
  receiptCode: r.receipt_code as string,
  firstSeen: ms(r.first_seen),
  lastSeen: ms(r.last_seen),
  appVersion: r.app_version as string,
});

/** Neon implementation of device sync storage (ADR-024, migration 005). */
export function neonSyncRepo(sql: Sql): SyncRepo {
  const rows = async (q: Promise<unknown>) => (await q) as Row[];
  return {
    async getBoundStore(accountId) {
      const [r] = await rows(sql`select store_id from account_store where account_id = ${accountId}`);
      return r ? (r.store_id as string) : null;
    },
    async bindStore(accountId, storeId, now) {
      await sql`insert into account_store (account_id, store_id, bound_at) values (${accountId}, ${storeId}, ${iso(now)}) on conflict (account_id) do nothing`;
      const [r] = await rows(sql`select store_id from account_store where account_id = ${accountId}`);
      return r!.store_id as string;
    },
    async rebindStore(accountId, storeId, now) {
      await sql.transaction([
        sql`delete from sync_records where account_id = ${accountId}`,
        sql`insert into account_store (account_id, store_id, bound_at) values (${accountId}, ${storeId}, ${iso(now)})
            on conflict (account_id) do update set store_id = excluded.store_id, replaced_at = excluded.bound_at`,
      ]);
    },
    async syncHeads(accountId, table, ids) {
      const out = new Map<string, SyncHead>();
      if (ids.length === 0) return out;
      const r = await rows(sql`select id, updated_at, data->>'status' as status from sync_records
        where account_id = ${accountId} and tbl = ${table} and id = any(${ids}::uuid[])`);
      for (const x of r) out.set(x.id as string, { updatedAt: ms(x.updated_at), status: table === 'orders' ? ((x.status as string | null) ?? null) : null });
      return out;
    },
    async putSyncRecords(accountId, deviceId, records, now) {
      if (records.length === 0) return;
      const payload = JSON.stringify(records.map((r) => ({ tbl: r.table, id: r.id, data: r.data, updated_at: iso(r.updatedAt) })));
      // One statement for the batch; the where clause keeps a newer row written meanwhile by another device.
      await sql`insert into sync_records (account_id, tbl, id, data, updated_at, device_id, changed_at)
        select ${accountId}, x.tbl, x.id, x.data, x.updated_at, ${deviceId}, ${iso(now)}
        from jsonb_to_recordset(${payload}::jsonb) as x(tbl text, id uuid, data jsonb, updated_at timestamptz)
        on conflict (account_id, tbl, id) do update
          set data = excluded.data, updated_at = excluded.updated_at, device_id = excluded.device_id,
              seq = nextval('sync_seq'), changed_at = excluded.changed_at
          where sync_records.updated_at <= excluded.updated_at`;
    },
    async pullSyncRecords(accountId, deviceId, after, limit, settledBefore) {
      const r = await rows(sql`select tbl, id, data, updated_at, seq from sync_records
        where account_id = ${accountId} and seq > ${after} and device_id <> ${deviceId} and changed_at <= ${iso(settledBefore)}
        order by seq limit ${limit}`);
      return r.map((x) => ({ table: x.tbl as SyncTableName, id: x.id as string, data: x.data as Record<string, unknown>, updatedAt: ms(x.updated_at), seq: Number(x.seq) }));
    },
    async storeSummary(accountId) {
      const [bound] = await rows(sql`select 1 from account_store where account_id = ${accountId}`);
      if (!bound) return null;
      const [r] = await rows(sql`select
          (select s.data->>'name' from sync_records s join account_store a on a.account_id = s.account_id
            where s.account_id = ${accountId} and s.tbl = 'stores' and s.id = a.store_id) as name,
          (select count(*) from sync_records where account_id = ${accountId} and tbl = 'products' and data->>'deletedAt' is null) as products,
          (select count(*) from sync_records where account_id = ${accountId} and tbl = 'orders' and data->>'status' not in ('open', 'cancelled')) as orders,
          (select max(data->>'createdAt') from sync_records where account_id = ${accountId} and tbl = 'orders' and data->>'status' not in ('open', 'cancelled')) as last_sale`);
      if (!r) return null;
      return { name: (r.name as string | null) ?? '', products: Number(r.products), orders: Number(r.orders), lastSaleAt: (r.last_sale as string | null) ?? null };
    },
    async touchDevice(accountId, hello, now) {
      await sql`insert into sync_devices (account_id, device_id, receipt_code, app_version, first_seen, last_seen)
        values (${accountId}, ${hello.deviceId}, ${hello.receiptCode}, ${hello.appVersion}, ${iso(now)}, ${iso(now)})
        on conflict (account_id, device_id) do update
          set receipt_code = excluded.receipt_code, app_version = excluded.app_version, last_seen = excluded.last_seen`;
    },
    async listDevices(accountId) {
      return (await rows(sql`select * from sync_devices where account_id = ${accountId} order by first_seen`)).map(device);
    },
    async renameDevice(accountId, deviceId, name) {
      const r = await rows(sql`update sync_devices set name = ${name} where account_id = ${accountId} and device_id = ${deviceId} returning device_id`);
      return r.length === 1;
    },
  };
}

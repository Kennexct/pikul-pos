import { orderStatus } from './syncCheck';
import type { StoredSyncRecord, SyncDevice, SyncHead, SyncRepo } from './syncTypes';

interface MemRow extends StoredSyncRecord {
  accountId: string;
  deviceId: string;
  changedAt: number;
}

/** In-memory SyncRepo for tests and local dev (ADR-024). Mirrors the Neon semantics, including the settle window. */
export function memorySyncRepo(): SyncRepo & { rows: Map<string, MemRow> } {
  const stores = new Map<string, string>();
  const rows = new Map<string, MemRow>();
  const devices = new Map<string, SyncDevice & { accountId: string }>();
  let seq = 0;
  const key = (accountId: string, table: string, id: string) => `${accountId}|${table}|${id}`;
  const live = (accountId: string, table: string) =>
    [...rows.values()].filter((r) => r.accountId === accountId && r.table === table && !r.data.deletedAt);

  return {
    rows,
    async getBoundStore(accountId) {
      return stores.get(accountId) ?? null;
    },
    async bindStore(accountId, storeId) {
      if (!stores.has(accountId)) stores.set(accountId, storeId);
      return stores.get(accountId)!;
    },
    async rebindStore(accountId, storeId) {
      for (const [k, r] of rows) if (r.accountId === accountId) rows.delete(k);
      stores.set(accountId, storeId);
    },
    async syncHeads(accountId, table, ids) {
      const out = new Map<string, SyncHead>();
      for (const id of ids) {
        const r = rows.get(key(accountId, table, id));
        if (r) out.set(id, { updatedAt: r.updatedAt, status: table === 'orders' ? orderStatus(r.data) : null });
      }
      return out;
    },
    async putSyncRecords(accountId, deviceId, records, now) {
      for (const r of records) {
        const k = key(accountId, r.table, r.id);
        const existing = rows.get(k);
        if (existing && existing.updatedAt > r.updatedAt) continue;
        rows.set(k, { ...structuredClone(r), accountId, deviceId, seq: ++seq, changedAt: now });
      }
    },
    async pullSyncRecords(accountId, deviceId, after, limit, settledBefore) {
      return [...rows.values()]
        .filter((r) => r.accountId === accountId && r.seq > after && r.deviceId !== deviceId && r.changedAt <= settledBefore)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit)
        .map(({ table, id, data, updatedAt, seq: s }) => ({ table, id, data: structuredClone(data), updatedAt, seq: s }));
    },
    async storeSummary(accountId) {
      const storeId = stores.get(accountId);
      if (!storeId) return null;
      const store = rows.get(key(accountId, 'stores', storeId));
      const orders = live(accountId, 'orders').filter((o) => o.data.status !== 'open' && o.data.status !== 'cancelled');
      const last = orders.map((o) => String(o.data.createdAt ?? '')).sort().at(-1) ?? null;
      return { name: typeof store?.data.name === 'string' ? store.data.name : '', products: live(accountId, 'products').length, orders: orders.length, lastSaleAt: last };
    },
    async touchDevice(accountId, hello, now) {
      const k = `${accountId}|${hello.deviceId}`;
      const d = devices.get(k);
      devices.set(k, { accountId, deviceId: hello.deviceId, name: d?.name ?? '', receiptCode: hello.receiptCode, appVersion: hello.appVersion, firstSeen: d?.firstSeen ?? now, lastSeen: now });
    },
    async listDevices(accountId) {
      return [...devices.values()].filter((d) => d.accountId === accountId).map(({ accountId: _a, ...d }) => ({ ...d }));
    },
    async renameDevice(accountId, deviceId, name) {
      const d = devices.get(`${accountId}|${deviceId}`);
      if (!d) return false;
      d.name = name;
      return true;
    },
  };
}

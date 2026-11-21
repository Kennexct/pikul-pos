import Dexie from 'dexie';
import { version } from '../../package.json';
import { SYNC_BATCH_SIZE, SYNC_MAX_ATTEMPTS } from '../constants';
import { localDb } from '../db/localDb';
import { nowIso } from '../lib/id';
import type { Id, OutboxEntry, Result, SyncTable } from '../types';
import { SYNC_TABLES } from '../types';
import { ApiError, accountApi } from './account';
import { getDeviceId, getReceiptCode } from './device';
import { t } from '../i18n';

/**
 * Device sync (ADR-024). Every write goes through `saveAndQueue` (record + outbox row in one transaction);
 * `syncNow` pushes the outbox to the Pikul server, then pulls what other devices wrote. Never on the sell path.
 */

export const SYNC_KEYS = { account: 'sync.accountId', store: 'sync.storeId', cursor: 'sync.cursor', lastAt: 'sync.lastAt' } as const;
const PUSH_MAX_CHARS = 3_500_000;
const PULL_MAX_PAGES = 40;
const REJECTED = 'rejected:';

/**
 * Write a record locally AND queue it for sync in one transaction,
 * so a crash can never leave a sale saved but unsynced-forever.
 */
export async function saveAndQueue<T extends { id: Id }>(table: SyncTable, record: T): Promise<void> {
  const localTable = localDb.table(table);
  await localDb.transaction('rw', localTable, localDb.outbox, async () => {
    await localTable.put(record);
    await localDb.outbox.add({ table, recordId: record.id, op: 'upsert', queuedAt: nowIso(), attempts: 0 });
  });
}

export interface Binding {
  accountId: Id;
  storeId: Id;
}

export async function getBinding(): Promise<Binding | null> {
  const [a, s] = await Promise.all([localDb.meta.get(SYNC_KEYS.account), localDb.meta.get(SYNC_KEYS.store)]);
  return a && s ? { accountId: a.value, storeId: s.value } : null;
}

export async function setBinding(b: Binding): Promise<void> {
  await localDb.meta.bulkPut([
    { key: SYNC_KEYS.account, value: b.accountId },
    { key: SYNC_KEYS.store, value: b.storeId },
  ]);
}

/** Forget which account this device syncs with and restart the pull from the beginning. */
export async function clearBinding(): Promise<void> {
  await localDb.meta.bulkDelete(Object.values(SYNC_KEYS));
}

/** Queues every record of the store (store row first), for a device that syncs this store for the first time. */
export async function enqueueAll(): Promise<number> {
  const queuedAt = nowIso();
  let count = 0;
  await localDb.transaction('rw', [...SYNC_TABLES.map((n) => localDb.table(n)), localDb.outbox], async () => {
    await localDb.outbox.clear();
    for (const table of SYNC_TABLES) {
      const ids = (await localDb.table(table).toCollection().primaryKeys()) as Id[];
      await localDb.outbox.bulkAdd(ids.map((recordId): OutboxEntry => ({ table, recordId, op: 'upsert', queuedAt, attempts: 0 })));
      count += ids.length;
    }
  });
  return count;
}

async function hello() {
  return { deviceId: await getDeviceId(), receiptCode: await getReceiptCode(), appVersion: version };
}

interface PushReply {
  saved: number;
  rejected: Array<{ table: unknown; id: unknown; error: string }>;
}

/** One push round: up to 100 records or ~3.5 MB. Returns how many outbox rows were settled. */
async function pushBatch(binding: Binding): Promise<number> {
  const entries = await localDb.outbox
    .orderBy('seq')
    .filter((e) => !(e.lastError ?? '').startsWith(REJECTED))
    .limit(SYNC_BATCH_SIZE * 3)
    .toArray();
  if (entries.length === 0) return 0;

  const latest = new Map<string, OutboxEntry>(); // table|id → newest entry; older duplicates settle with it
  for (const e of entries) latest.set(`${e.table}|${e.recordId}`, e);
  const records: Array<{ table: SyncTable; id: Id; data: Record<string, unknown> }> = [];
  const sent: OutboxEntry[] = [];
  let chars = 0;
  for (const entry of latest.values()) {
    if (records.length >= SYNC_BATCH_SIZE) break;
    const data = (await localDb.table(entry.table).get(entry.recordId)) as Record<string, unknown> | undefined;
    if (!data) {
      sent.push(entry); // gone locally: nothing to send
      continue;
    }
    const size = JSON.stringify(data).length;
    if (records.length > 0 && chars + size > PUSH_MAX_CHARS) break;
    chars += size;
    records.push({ table: entry.table, id: entry.recordId, data });
    sent.push(entry);
  }

  const reply = records.length > 0 ? await accountApi<PushReply>('POST', '/api/sync/push', { storeId: binding.storeId, ...(await hello()), records }, true) : { saved: 0, rejected: [] };
  const rejected = new Map(reply.rejected.map((r) => [`${String(r.table)}|${String(r.id)}`, r.error]));
  const sentKeys = new Set(sent.map((e) => `${e.table}|${e.recordId}`));
  const maxSeq = new Map(sent.map((e) => [`${e.table}|${e.recordId}`, e.seq ?? 0]));
  // Settle every queued row of a sent record up to the newest one we sent; a write queued meanwhile stays.
  const settle = entries.filter((e) => sentKeys.has(`${e.table}|${e.recordId}`) && (e.seq ?? 0) <= (maxSeq.get(`${e.table}|${e.recordId}`) ?? 0));
  await localDb.transaction('rw', localDb.outbox, async () => {
    for (const e of settle) {
      const error = rejected.get(`${e.table}|${e.recordId}`);
      if (error && e.seq === maxSeq.get(`${e.table}|${e.recordId}`)) {
        await localDb.outbox.update(e.seq!, { attempts: SYNC_MAX_ATTEMPTS, lastError: `${REJECTED}${error}` });
      } else if (e.seq !== undefined) await localDb.outbox.delete(e.seq);
    }
  });
  return settle.length;
}

/** Pushes until the outbox is empty (or 20 rounds). */
export async function pushOutbox(binding: Binding): Promise<number> {
  let total = 0;
  for (let round = 0; round < 20; round++) {
    const n = await pushBatch(binding);
    if (n === 0) break;
    total += n;
  }
  return total;
}

const time = (v: unknown) => (typeof v === 'string' ? Date.parse(v) || 0 : 0);

/** Writes other devices' records into IndexedDB when newer than ours. Never re-queued. */
export async function applyRemote(rows: ReadonlyArray<{ table: string; id: Id; data: Record<string, unknown> }>): Promise<number> {
  const byTable = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rows) {
    if (!(SYNC_TABLES as readonly string[]).includes(r.table) || r.data.id !== r.id) continue;
    byTable.set(r.table, [...(byTable.get(r.table) ?? []), r.data]);
  }
  let applied = 0;
  for (const [name, incoming] of byTable) {
    const table = localDb.table(name);
    await localDb.transaction('rw', table, async () => {
      const local = (await table.bulkGet(incoming.map((d) => d.id as string))) as Array<Record<string, unknown> | undefined>;
      const newer = incoming.filter((d, i) => !local[i] || time(d.updatedAt) > time(local[i]?.updatedAt));
      if (newer.length > 0) await table.bulkPut(newer);
      applied += newer.length;
    });
  }
  return applied;
}

interface PullPage {
  records: Array<{ table: string; id: Id; data: Record<string, unknown> }>;
  cursor: number;
  more: boolean;
}

export async function fetchPage(binding: Binding, after: number): Promise<PullPage> {
  const q = new URLSearchParams({ storeId: binding.storeId, deviceId: await getDeviceId(), after: String(after) });
  return accountApi<PullPage>('GET', `/api/sync/pull?${q.toString()}`, undefined, true);
}

/** Pulls and applies pages after the saved cursor. `onPage` reports progress (records so far). */
export async function pullChanges(binding: Binding, onPage?: (received: number) => void): Promise<number> {
  let after = Number((await localDb.meta.get(SYNC_KEYS.cursor))?.value ?? '0') || 0;
  let received = 0;
  for (let page = 0; page < PULL_MAX_PAGES; page++) {
    const p = await fetchPage(binding, after);
    await applyRemote(p.records);
    received += p.records.length;
    after = p.cursor;
    await localDb.meta.put({ key: SYNC_KEYS.cursor, value: String(after) });
    onPage?.(received);
    if (!p.more) break;
  }
  return received;
}

export type SyncOutcome = 'synced' | 'offline' | 'signedOut' | 'mismatch' | 'error' | 'unbound';

let running: Promise<SyncOutcome> | null = null;

/** Push, then pull. One run at a time; errors never throw (the caller only shows status). */
export function syncNow(): Promise<SyncOutcome> {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

async function runSync(): Promise<SyncOutcome> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  const binding = await Dexie.ignoreTransaction(getBinding);
  if (!binding) return 'unbound';
  try {
    await pushOutbox(binding);
    await pullChanges(binding);
    await localDb.meta.put({ key: SYNC_KEYS.lastAt, value: nowIso() });
    return 'synced';
  } catch (error) {
    return outcomeOf(error);
  }
}

export function outcomeOf(error: unknown): SyncOutcome {
  if (!(error instanceof ApiError)) return 'error';
  if (error.status === 0) return 'offline';
  if (error.status === 401) return 'signedOut';
  if (error.status === 409) return 'mismatch';
  return 'error';
}

export async function pendingCount(): Promise<number> {
  return localDb.outbox.count();
}

/** Rows the server refused (shown in Settings → Sinkronisasi; they never block the rest). */
export async function rejectedCount(): Promise<number> {
  return localDb.outbox.filter((e) => (e.lastError ?? '').startsWith(REJECTED)).count();
}

export async function lastSyncedAt(): Promise<string | null> {
  return (await localDb.meta.get(SYNC_KEYS.lastAt))?.value ?? null;
}

/** Kept for callers that only want a Result. */
export async function syncResult(): Promise<Result<true>> {
  const outcome = await syncNow();
  return outcome === 'synced' ? { ok: true, value: true } : { ok: false, error: t('Sinkronisasi tertunda. Data aman di perangkat.') };
}

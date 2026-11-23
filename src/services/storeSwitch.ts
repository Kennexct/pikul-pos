import { LEGACY_SAMPLE_REMOVED_KEY } from './legacySampleMenu';
import { localDb } from '../db/localDb';
import { downloadBlob } from '../lib/export/deliver';
import { isDeviceMetaKey } from '../lib/backup';
import { nowIso } from '../lib/id';
import type { Id } from '../types';
import { SYNC_TABLES } from '../types';
import { accountApi } from './account';
import { backupFromTables, clearDeviceSession, createBackup } from './backup';
import { getDeviceId, getReceiptCode } from './device';
import { accountId } from './syncBinding';
import { clearBinding, enqueueAll, fetchPage, pullChanges, setBinding, syncNow } from './sync';
import { version } from '../../package.json';
import { t } from '../i18n';

/** Downloading a store onto this device, and replacing one store with another (ADR-025, spec §3). */

/** Clears every store table and store-scoped setting; keeps this device's id, receipt code and receipt counters. */
export async function wipeStoreData(): Promise<void> {
  await localDb.transaction('rw', localDb.tables, async () => {
    const keep = (await localDb.meta.toArray()).filter((row) => (isDeviceMetaKey(row.key) && !row.key.startsWith('sync.')) || row.key.startsWith('seq:'));
    for (const table of localDb.tables) await table.clear();
    await localDb.meta.bulkPut(keep);
  });
  clearDeviceSession();
}

export class StoreNotReadyError extends Error {}

/**
 * Downloads the account's store onto an empty device. `onProgress` gets the number of records so far.
 * Throws StoreNotReadyError when the server has no store row yet (the first device has not finished uploading).
 */
export async function downloadStore(storeId: Id, onProgress?: (received: number) => void): Promise<void> {
  const account = await accountId();
  if (!account) throw new Error(t('Silakan masuk lagi.'));
  await wipeStoreData();
  const binding = { accountId: account, storeId };
  await setBinding(binding);
  let total = 0;
  for (let round = 0; round < 50; round++) {
    const before = total;
    const n = await pullChanges(binding, (k) => onProgress?.(before + k));
    if (n === 0) break;
    total += n;
  }
  if (!(await localDb.stores.get(storeId))) {
    await wipeStoreData();
    throw new StoreNotReadyError(t('Toko di akun ini belum selesai diunggah. Buka Pikul di perangkat pertama sampai online, lalu coba lagi.'));
  }
  // Downloaded data is the merchant's own: the one-time example-menu clean-up must never touch it (ADR-018).
  await localDb.meta.put({ key: LEGACY_SAMPLE_REMOVED_KEY, value: nowIso() });
}

/** Saves this device's store as a backup file, then removes it. */
export async function backUpAndWipeLocal(): Promise<void> {
  const { blob, fileName } = await createBackup();
  downloadBlob(blob, fileName);
  await wipeStoreData();
}

/** "Pakai toko dari akun": back up this device's store, then download the account's store. */
export async function adoptAccountStore(remoteStoreId: Id, onProgress?: (received: number) => void): Promise<void> {
  await backUpAndWipeLocal();
  await downloadStore(remoteStoreId, onProgress);
}

/** Downloads every record of the account's current store into memory, as backup-file tables. */
async function remoteTables(storeId: Id): Promise<Record<string, Array<Record<string, unknown>>>> {
  const account = await accountId();
  if (!account) throw new Error(t('Silakan masuk lagi.'));
  const byId = new Map<string, Record<string, unknown>>();
  let after = 0;
  for (let page = 0; page < 200; page++) {
    const p = await fetchPage({ accountId: account, storeId }, after);
    for (const r of p.records) byId.set(`${r.table}|${r.id}`, r.data);
    after = p.cursor;
    if (!p.more) break;
  }
  const tables: Record<string, Array<Record<string, unknown>>> = Object.fromEntries(SYNC_TABLES.map((n) => [n, []]));
  for (const [key, data] of byId) tables[key.split('|')[0]!]?.push(data);
  tables.meta = [];
  return tables;
}

/**
 * "Pakai toko di perangkat ini": the account's store is saved as a backup file first, then the server
 * replaces it with this device's store (password needed), and everything here is uploaded.
 */
export async function keepDeviceStore(localStoreId: Id, remoteStoreId: Id, password: string): Promise<void> {
  const account = await accountId();
  if (!account) throw new Error(t('Silakan masuk lagi.'));
  const tables = await remoteTables(remoteStoreId);
  if ((tables.stores ?? []).length > 0) {
    const { blob, fileName } = backupFromTables(tables);
    downloadBlob(blob, fileName);
  }
  const hello = { deviceId: await getDeviceId(), receiptCode: await getReceiptCode(), appVersion: version };
  await accountApi('POST', '/api/sync/replace', { storeId: localStoreId, password, ...hello }, true);
  await clearBinding();
  await setBinding({ accountId: account, storeId: localStoreId });
  await enqueueAll();
  void syncNow();
}

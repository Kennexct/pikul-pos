import { ACTIVE_MEMBER_STORAGE_KEY, BACKUP_APP_ID, BACKUP_FORMAT_VERSION, BACKUP_MAX_BYTES, LAST_BACKUP_KEY, RESTORED_AT_KEY } from '../constants';
import { localDb } from '../db/localDb';
import { BackupError, backupFileName, isDeviceMetaKey, isPortableMetaKey, parseBackup, type BackupFile } from '../lib/backup';
import { nowIso } from '../lib/id';
import { t } from '../i18n';

/** Legacy identifier, frozen (ADR-016). */
const CART_STORAGE_KEY = 'kasirku-cart';
/** Everything except the sync queue, which only makes sense on the device that queued it (ADR-008). */
const backupTables = () => localDb.tables.filter((table) => table.name !== 'outbox');
const tableNames = () => backupTables().map((table) => table.name);

export interface BackupResult {
  blob: Blob;
  fileName: string;
  counts: Record<string, number>;
}

/** Reads every table in one read transaction, so the file is a consistent snapshot. */
export async function createBackup(now: Date = new Date()): Promise<BackupResult> {
  const tables: BackupFile['tables'] = {};
  await localDb.transaction('r', backupTables(), async () => {
    for (const table of backupTables()) {
      const rows = (await table.toArray()) as Array<Record<string, unknown>>;
      tables[table.name] = table.name === 'meta' ? rows.filter((row) => isPortableMetaKey(String(row.key))) : rows;
    }
  });
  return backupFromTables(tables, now);
}

/** Builds a backup file from table rows, e.g. a store downloaded from the server before it is replaced (ADR-024). */
export function backupFromTables(tables: BackupFile['tables'], now: Date = new Date()): BackupResult {
  const storeName = String(tables.stores?.[0]?.name ?? t('Toko'));
  const counts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]));
  const file: BackupFile = {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: localDb.verno,
    exportedAt: now.toISOString(),
    storeName,
    counts,
    tables,
  };
  return { blob: new Blob([JSON.stringify(file)], { type: 'application/json' }), fileName: backupFileName(storeName, now), counts };
}

export async function markBackedUp(): Promise<void> {
  await localDb.meta.put({ key: LAST_BACKUP_KEY, value: nowIso() });
}

export async function getLastBackupAt(): Promise<string | null> {
  return (await localDb.meta.get(LAST_BACKUP_KEY))?.value ?? null;
}

/** Reads and validates a chosen file. Nothing on the device changes here. */
export async function readBackupFile(file: Blob): Promise<BackupFile> {
  if (file.size > BACKUP_MAX_BYTES) throw new BackupError(t('Berkas terlalu besar untuk dipulihkan di perangkat ini.'));
  return parseBackup(await file.text(), localDb.verno, tableNames());
}

/**
 * Replace-all restore (ADR-008): one transaction clears every table and writes the file's rows, so a failure
 * leaves the device exactly as it was. The sync queue is emptied; `restoredAt` tells a future sync to re-push everything.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await localDb.transaction('rw', localDb.tables, async () => {
    // This device keeps its own identity; the restored store syncs as if this device were new to it (ADR-024).
    const device = (await localDb.meta.toArray()).filter((row) => isDeviceMetaKey(row.key) && !row.key.startsWith('sync.'));
    for (const table of localDb.tables) await table.clear();
    await localDb.meta.bulkPut(device);
    for (const table of backupTables()) await table.bulkPut(backup.tables[table.name] ?? []);
    await localDb.meta.put({ key: RESTORED_AT_KEY, value: nowIso() });
    // The file itself is the latest backup of what is now on the device.
    if (backup.exportedAt) await localDb.meta.put({ key: LAST_BACKUP_KEY, value: backup.exportedAt });
  });
}

/** The cart and signed-in seller belong to the old data; drop them before reloading into the restored store. */
export function clearDeviceSession(): void {
  localStorage.removeItem(CART_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_MEMBER_STORAGE_KEY);
}

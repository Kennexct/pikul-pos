import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION } from '../constants';
import { t } from '../i18n';

/**
 * Backup file format (ADR-008). This module only reads and checks a file's text — it never touches the database,
 * so every rejection rule is unit-tested without a browser.
 */
export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  /** Dexie schema version of the device that wrote the file. */
  schemaVersion: number;
  exportedAt: string;
  storeName: string;
  counts: Record<string, number>;
  /** Table name → rows. Every table except the sync queue. */
  tables: Record<string, Array<Record<string, unknown>>>;
}

/** Tables keyed by something other than `id`. */
const KEY_FIELD: Record<string, string> = { meta: 'key' };
/** This device's identity and sync position (ADR-025, ADR-026): never copied to or from a file. */
export const isDeviceMetaKey = (key: string): boolean => key === 'deviceId' || key === 'deviceCode' || key.startsWith('sync.');
/** Device-local state that must not travel: PIN lockout counters, device identity, sync position. */
export const isPortableMetaKey = (key: string): boolean => !key.startsWith('pinlock:') && !isDeviceMetaKey(key);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export class BackupError extends Error {}

/**
 * Parses and validates backup text. Throws `BackupError` with a message for the merchant.
 * Unknown tables are dropped; known tables missing from the file become empty.
 */
export function parseBackup(text: string, currentSchemaVersion: number, knownTables: readonly string[]): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError(t('Berkas rusak atau bukan berkas cadangan Pikul.'));
  }
  if (!isRecord(raw) || raw.app !== BACKUP_APP_ID || !isRecord(raw.tables)) {
    throw new BackupError(t('Ini bukan berkas cadangan Pikul.'));
  }
  if (typeof raw.formatVersion !== 'number' || raw.formatVersion > BACKUP_FORMAT_VERSION || typeof raw.schemaVersion !== 'number' || raw.schemaVersion > currentSchemaVersion) {
    throw new BackupError(t('Cadangan ini dibuat dengan versi aplikasi yang lebih baru. Perbarui aplikasi, lalu coba lagi.'));
  }

  const tables: BackupFile['tables'] = {};
  for (const name of knownTables) {
    const rows = raw.tables[name] ?? [];
    const keyField = KEY_FIELD[name] ?? 'id';
    if (!Array.isArray(rows) || !rows.every((row) => isRecord(row) && typeof row[keyField] === 'string' && row[keyField] !== '')) {
      throw new BackupError(t('Berkas cadangan rusak (data "{0}" tidak terbaca).', name));
    }
    tables[name] = name === 'meta' ? rows.filter((row) => isPortableMetaKey(String(row.key))) : rows;
  }

  const stores = tables.stores ?? [];
  if (stores.length !== 1) throw new BackupError(t('Berkas cadangan rusak (data toko tidak lengkap).'));
  const owner = (tables.storeMembers ?? []).some((m) => m.role === 'owner' && !m.deletedAt);
  if (!owner) throw new BackupError(t('Berkas cadangan rusak (data pemilik tidak ada).'));

  return {
    app: BACKUP_APP_ID,
    formatVersion: raw.formatVersion,
    schemaVersion: raw.schemaVersion,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    storeName: typeof stores[0]?.name === 'string' ? stores[0].name : t('Toko'),
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    tables,
  };
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'toko';
const pad = (n: number) => String(n).padStart(2, '0');

/** pikul-cadangan-warung-bakso-20261119-2130.json (device local time). */
export function backupFileName(storeName: string, at: Date): string {
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `pikul-cadangan-${slug(storeName)}-${stamp}.json`;
}

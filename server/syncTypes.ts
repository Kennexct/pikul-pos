/** Device sync (ADR-024): what the server stores for each account's store. */

/** Dexie table names the app syncs, plus the store row itself. */
export const SYNC_TABLES = [
  'categories',
  'products',
  'variantGroups',
  'salesModes',
  'paymentMethods',
  'discounts',
  'customers',
  'orders',
  'refunds',
  'auditEvents',
  'storeMembers',
  'expenses',
  'dayClosings',
  'stores',
] as const;
export type SyncTableName = (typeof SYNC_TABLES)[number];

/** One record as the device sent it: its JSON is stored as-is. */
export interface SyncRecord {
  table: SyncTableName;
  id: string;
  data: Record<string, unknown>;
  /** Epoch ms from data.updatedAt (0 when the record has none, such as an old store row). */
  updatedAt: number;
}

export interface StoredSyncRecord extends SyncRecord {
  seq: number;
}

/** What the server already has for a record, to decide last write wins. */
export interface SyncHead {
  updatedAt: number;
  status: string | null;
}

export interface SyncDevice {
  deviceId: string;
  name: string;
  receiptCode: string;
  firstSeen: number;
  lastSeen: number;
  appVersion: string;
}

export interface DeviceHello {
  deviceId: string;
  receiptCode: string;
  appVersion: string;
}

export interface StoreSummary {
  name: string;
  products: number;
  orders: number;
  lastSaleAt: string | null;
}

export interface SyncRepo {
  /** The store id this account is tied to, or null before the first device claims it. */
  getBoundStore(accountId: string): Promise<string | null>;
  /** Ties the account to storeId when it has no store yet. Returns the store the account is tied to afterwards. */
  bindStore(accountId: string, storeId: string, now: number): Promise<string>;
  /** "Pakai toko di perangkat ini": drops every record of the account and ties it to storeId. */
  rebindStore(accountId: string, storeId: string, now: number): Promise<void>;
  syncHeads(accountId: string, table: SyncTableName, ids: string[]): Promise<Map<string, SyncHead>>;
  /** Upserts; a row is only replaced when the incoming updatedAt is not older (race guard). */
  putSyncRecords(accountId: string, deviceId: string, records: SyncRecord[], now: number): Promise<void>;
  /** Rows with seq > after, not last written by deviceId, changed before settledBefore, oldest first. */
  pullSyncRecords(accountId: string, deviceId: string, after: number, limit: number, settledBefore: number): Promise<StoredSyncRecord[]>;
  storeSummary(accountId: string): Promise<StoreSummary | null>;
  touchDevice(accountId: string, hello: DeviceHello, now: number): Promise<void>;
  listDevices(accountId: string): Promise<SyncDevice[]>;
  renameDevice(accountId: string, deviceId: string, name: string): Promise<boolean>;
}

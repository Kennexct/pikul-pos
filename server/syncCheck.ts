import { SYNC_TABLES, type DeviceHello, type SyncHead, type SyncRecord, type SyncTableName } from './syncTypes';
import { DAY_MS } from './types';

/** Validation and the last-write-wins rule for device sync (ADR-025). Pure, so both are unit tested. */

export const MAX_PUSH_RECORDS = 100;
export const MAX_RECORD_CHARS = 1_500_000;
export const PUSH_BODY_LIMIT = 4_000_000;
export const PULL_PAGE = 500;
/** A row is pulled only once it is this old, so a slower insert holding a lower seq is never skipped. */
export const PULL_SETTLE_MS = 3_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RECEIPT_CODE_RE = /^[A-HJ-NP-Z2-9]{2}$/;
const VERSION_RE = /^[0-9A-Za-z.+-]{1,20}$/;
/** An order in one of these never goes back to "open" (a late edit from another device must not undo a payment). */
const FINAL_ORDER = new Set(['paid', 'void', 'refunded', 'partial_refund', 'cancelled']);

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const isTable = (v: unknown): v is SyncTableName => typeof v === 'string' && (SYNC_TABLES as readonly string[]).includes(v);

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkHello(b: Record<string, unknown>): Checked<DeviceHello> {
  if (!isUuid(b.deviceId)) return { ok: false, error: 'invalid_device' };
  const receiptCode = typeof b.receiptCode === 'string' && RECEIPT_CODE_RE.test(b.receiptCode) ? b.receiptCode : '';
  const appVersion = typeof b.appVersion === 'string' && VERSION_RE.test(b.appVersion) ? b.appVersion : '';
  const autoName = cleanDeviceName(b.autoName, 40) ?? '';
  const privateMode = b.privateMode === true || b.privateMode === '1';
  return { ok: true, value: { deviceId: b.deviceId, receiptCode, appVersion, autoName, privateMode } };
}

/** One pushed record: known table, UUID id, belongs to the account's store, sane updatedAt, not too big. */
export function checkRecord(v: unknown, storeId: string, now: number): Checked<SyncRecord> {
  const o = (v ?? {}) as Record<string, unknown>;
  if (!isTable(o.table)) return { ok: false, error: 'invalid_table' };
  if (!isUuid(o.id)) return { ok: false, error: 'invalid_id' };
  const data = o.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, error: 'invalid_data' };
  const d = data as Record<string, unknown>;
  if (d.id !== o.id) return { ok: false, error: 'id_mismatch' };
  if (o.table === 'stores' ? o.id !== storeId : d.storeId !== storeId) return { ok: false, error: 'wrong_store' };
  let updatedAt = 0;
  if (d.updatedAt !== undefined) {
    updatedAt = typeof d.updatedAt === 'string' ? Date.parse(d.updatedAt) : NaN;
    if (!Number.isFinite(updatedAt) || updatedAt > now + DAY_MS) return { ok: false, error: 'invalid_updated_at' };
  } else if (o.table !== 'stores') return { ok: false, error: 'invalid_updated_at' };
  if (JSON.stringify(d).length > MAX_RECORD_CHARS) return { ok: false, error: 'record_too_large' };
  return { ok: true, value: { table: o.table, id: o.id, data: d, updatedAt } };
}

/** Last write wins by updatedAt; equal means "already have it"; final orders never reopen. */
export function shouldApply(existing: SyncHead | undefined, incoming: SyncRecord): boolean {
  if (!existing) return true;
  if (incoming.updatedAt <= existing.updatedAt) return false;
  if (incoming.table === 'orders' && existing.status !== null && FINAL_ORDER.has(existing.status) && incoming.data.status === 'open') return false;
  return true;
}

export const orderStatus = (data: Record<string, unknown>): string | null => (typeof data.status === 'string' ? data.status : null);

export function cleanDeviceName(v: unknown, max = 30): string | null {
  if (typeof v !== 'string') return null;
  const name = v.trim();
  return name.length >= 1 && name.length <= max && !/[\u0000-\u001f\u007f<>]/.test(name) ? name : null;
}

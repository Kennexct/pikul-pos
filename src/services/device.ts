import Dexie from 'dexie';
import { localDb } from '../db/localDb';
import { uuidv7 } from '../lib/id';
import type { Id } from '../types';

/**
 * This device's identity (ADR-024, ADR-025). Never synced.
 * - deviceId: random UUID; owns this device's cash register records and identifies it to the sync server.
 * - receipt code: 2 characters inside receipt numbers so offline devices never print the same number.
 */
export const DEVICE_ID_KEY = 'deviceId';
export const DEVICE_CODE_KEY = 'deviceCode';
const DEVICE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let cachedId: Id | null = null;

export async function getDeviceId(): Promise<Id> {
  if (cachedId) return cachedId;
  // Outside any caller's transaction or live query: those may not include `meta` or may be read-only.
  const id = await Dexie.ignoreTransaction(() =>
    localDb.transaction('rw', localDb.meta, async () => {
      const existing = await localDb.meta.get(DEVICE_ID_KEY);
      if (existing) return existing.value;
      const fresh = uuidv7();
      await localDb.meta.put({ key: DEVICE_ID_KEY, value: fresh });
      return fresh;
    }),
  );
  cachedId = id;
  return id;
}

/** True when a cash record belongs to this device's drawer. Records without a device id were made before v0.19, on this device. */
export function isThisDevice(record: { deviceId?: Id }, deviceId: Id): boolean {
  return (record.deviceId ?? deviceId) === deviceId;
}

function randomCode(avoid: ReadonlySet<string> = new Set()): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(2));
    const code = Array.from(bytes, (b) => DEVICE_CODE_CHARS[b % DEVICE_CODE_CHARS.length]).join('');
    if (!avoid.has(code) || avoid.size >= DEVICE_CODE_CHARS.length ** 2) return code;
  }
}

export async function getReceiptCode(): Promise<string> {
  const existing = await localDb.meta.get(DEVICE_CODE_KEY);
  if (existing) return existing.value;
  const code = randomCode();
  await localDb.meta.put({ key: DEVICE_CODE_KEY, value: code });
  return code;
}

/**
 * Another device on the account already uses this receipt code and was seen first: take a new one,
 * so two devices never print the same receipt number on the same day.
 */
export async function avoidReceiptCodes(taken: ReadonlySet<string>): Promise<string> {
  const current = await getReceiptCode();
  if (!taken.has(current)) return current;
  const code = randomCode(taken);
  await localDb.meta.put({ key: DEVICE_CODE_KEY, value: code });
  return code;
}

/** Test hook: forget the cached id after the database was cleared. */
export function resetDeviceCache(): void {
  cachedId = null;
}

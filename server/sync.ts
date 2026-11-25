import { accountFromBearer } from './auth';
import { verifyPassword } from './password';
import { checkHello, checkRecord, cleanDeviceName, isUuid, MAX_PUSH_RECORDS, PULL_PAGE, PULL_SETTLE_MS, shouldApply } from './syncCheck';
import type { SyncDevice, SyncRecord, SyncTableName } from './syncTypes';
import type { Account, ApiResponse, Deps, RequestCtx } from './types';

/**
 * Device sync API (ADR-025). Bearer = the merchant's refresh token (not rotated), like daily totals.
 * Every call that reads or writes records names the store it expects; a different store gets 409 store_mismatch.
 */

export const MAX_REPLACE_TRIES_PER_HOUR = 5;
const HOUR_MS = 3_600_000;

type Authed = { account: Account } | { error: ApiResponse };
const signedOut: ApiResponse = { status: 401, body: { error: 'signed_out' } };
const bad = (error: string): ApiResponse => ({ status: 400, body: { error } });
const mismatch = (bound: string | null): ApiResponse => ({ status: 409, body: { error: bound ? 'store_mismatch' : 'not_claimed', storeId: bound } });

async function authed(deps: Deps, auth: string | null): Promise<Authed> {
  const account = await accountFromBearer(deps, auth);
  return account ? { account } : { error: signedOut };
}

/**
 * The name each device shows: the owner's name, else its browser and system ("Chrome · Android"), else
 * "Perangkat N" for devices from before v0.20.1. Two devices with the same browser and system get " 2", " 3"…
 */
export function namedDevices(devices: SyncDevice[]): SyncDevice[] {
  const seen = new Map<string, number>();
  return [...devices]
    .sort((a, b) => a.firstSeen - b.firstSeen)
    .map((d, i) => {
      const auto = d.autoName || `Perangkat ${i + 1}`;
      const n = (seen.get(auto) ?? 0) + 1;
      seen.set(auto, n);
      return { ...d, named: d.name !== '', name: d.name || (n > 1 ? `${auto} ${n}` : auto) };
    });
}

/** GET /api/sync/store — what the account has, so a device can decide: download, claim or ask (spec §3). */
export async function syncStore(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  const storeId = await deps.repo.getBoundStore(a.account.id);
  const summary = storeId ? await deps.repo.storeSummary(a.account.id) : null;
  return { status: 200, body: { storeId, summary, profile: { storeName: a.account.storeName ?? '' } } };
}

/** POST /api/sync/claim {storeId, deviceId, receiptCode, appVersion} — ties an account with no store to this device's store. */
export async function syncClaim(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  const b = (body ?? {}) as Record<string, unknown>;
  const hello = checkHello(b);
  if (!hello.ok) return bad(hello.error);
  if (!isUuid(b.storeId)) return bad('invalid_store');
  const now = deps.now();
  const bound = await deps.repo.bindStore(a.account.id, b.storeId, now);
  if (bound !== b.storeId) return mismatch(bound);
  await deps.repo.touchDevice(a.account.id, hello.value, now);
  return { status: 200, body: { ok: true, devices: namedDevices(await deps.repo.listDevices(a.account.id)) } };
}

async function checkStore(deps: Deps, accountId: string, storeId: unknown): Promise<ApiResponse | null> {
  if (!isUuid(storeId)) return bad('invalid_store');
  const bound = await deps.repo.getBoundStore(accountId);
  return bound === storeId ? null : mismatch(bound);
}

/** POST /api/sync/push {storeId, deviceId, receiptCode, appVersion, records[]} — last write wins per record. */
export async function syncPush(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  const b = (body ?? {}) as Record<string, unknown>;
  const hello = checkHello(b);
  if (!hello.ok) return bad(hello.error);
  const wrong = await checkStore(deps, a.account.id, b.storeId);
  if (wrong) return wrong;
  if (!Array.isArray(b.records) || b.records.length > MAX_PUSH_RECORDS) return bad('invalid_records');
  const now = deps.now();
  const storeId = b.storeId as string;

  // Invalid records are reported back one by one, so a single bad row never blocks the rest of the outbox.
  const rejected: Array<{ table: unknown; id: unknown; error: string }> = [];
  const byTable = new Map<SyncTableName, SyncRecord[]>();
  for (const raw of b.records) {
    const r = checkRecord(raw, storeId, now);
    if (!r.ok) {
      const o = (raw ?? {}) as Record<string, unknown>;
      rejected.push({ table: o.table, id: o.id, error: r.error });
      continue;
    }
    byTable.set(r.value.table, [...(byTable.get(r.value.table) ?? []), r.value]);
  }
  let saved = 0;
  for (const [table, records] of byTable) {
    const heads = await deps.repo.syncHeads(a.account.id, table, records.map((r) => r.id));
    const winners = latestPerId(records).filter((r) => shouldApply(heads.get(r.id), r));
    if (winners.length > 0) await deps.repo.putSyncRecords(a.account.id, hello.value.deviceId, winners, now);
    saved += winners.length;
  }
  await deps.repo.touchDevice(a.account.id, hello.value, now);
  return { status: 200, body: { ok: true, saved, rejected } };
}

/** The same record twice in one batch: keep the newest. */
function latestPerId(records: SyncRecord[]): SyncRecord[] {
  const best = new Map<string, SyncRecord>();
  for (const r of records) {
    const seen = best.get(r.id);
    if (!seen || r.updatedAt >= seen.updatedAt) best.set(r.id, r);
  }
  return [...best.values()];
}

/** GET /api/sync/pull?storeId&deviceId&after — records other devices wrote after the cursor, oldest first. */
export async function syncPull(deps: Deps, auth: string | null, ctx: RequestCtx): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  const q = ctx.query;
  const deviceId = q.get('deviceId');
  if (!isUuid(deviceId)) return bad('invalid_device');
  const wrong = await checkStore(deps, a.account.id, q.get('storeId'));
  if (wrong) return wrong;
  const after = Number(q.get('after') ?? '0');
  if (!Number.isSafeInteger(after) || after < 0) return bad('invalid_cursor');
  const now = deps.now();
  // Pulling counts as being active, so "last active" stays true for a device that only reads.
  // Apps before v0.20.1 send only the device id: leave their row alone rather than blank its receipt code.
  const hello = checkHello({ deviceId, receiptCode: q.get('receiptCode'), appVersion: q.get('appVersion'), autoName: q.get('autoName'), privateMode: q.get('privateMode') });
  if (hello.ok && hello.value.receiptCode) await deps.repo.touchDevice(a.account.id, hello.value, now);
  const rows = await deps.repo.pullSyncRecords(a.account.id, deviceId, after, PULL_PAGE, now - PULL_SETTLE_MS);
  const cursor = rows.length > 0 ? rows[rows.length - 1]!.seq : after;
  return {
    status: 200,
    body: { records: rows.map((r) => ({ table: r.table, id: r.id, data: r.data })), cursor, more: rows.length === PULL_PAGE },
  };
}

/** POST /api/sync/replace {storeId, password, deviceId…} — "Pakai toko di perangkat ini". Needs the password again. */
export async function syncReplace(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  const b = (body ?? {}) as Record<string, unknown>;
  const hello = checkHello(b);
  if (!hello.ok) return bad(hello.error);
  if (!isUuid(b.storeId)) return bad('invalid_store');
  const now = deps.now();
  const key = `sync-replace:${a.account.id}`;
  if ((await deps.repo.countRate(key, now - HOUR_MS)) >= MAX_REPLACE_TRIES_PER_HOUR) return { status: 429, body: { error: 'too_many' } };
  await deps.repo.addRate(key, now);
  const hash = await deps.repo.getPasswordHash(a.account.id);
  if (typeof b.password !== 'string' || !(await verifyPassword(b.password, hash))) return { status: 403, body: { error: 'wrong_password' } };
  await deps.repo.rebindStore(a.account.id, b.storeId, now);
  await deps.repo.touchDevice(a.account.id, hello.value, now);
  return { status: 200, body: { ok: true } };
}

/** GET /api/sync/devices */
export async function syncDevices(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  return { status: 200, body: { devices: namedDevices(await deps.repo.listDevices(a.account.id)) } };
}

/** POST /api/sync/devices/name {deviceId, name} */
export async function syncRenameDevice(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  const b = (body ?? {}) as Record<string, unknown>;
  const name = cleanDeviceName(b.name);
  if (!isUuid(b.deviceId) || !name) return bad('invalid_name');
  if (!(await deps.repo.renameDevice(a.account.id, b.deviceId, name))) return { status: 404, body: { error: 'not_found' } };
  return { status: 200, body: { devices: namedDevices(await deps.repo.listDevices(a.account.id)) } };
}

/** POST /api/sync/devices/remove {deviceId, self} — the owner takes an old device (say a closed incognito window) off the list. */
export async function syncRemoveDevice(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await authed(deps, auth);
  if ('error' in a) return a.error;
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(b.deviceId)) return bad('invalid_device');
  if (b.deviceId === b.self) return bad('this_device');
  if (!(await deps.repo.removeDevice(a.account.id, b.deviceId))) return { status: 404, body: { error: 'not_found' } };
  return { status: 200, body: { devices: namedDevices(await deps.repo.listDevices(a.account.id)) } };
}

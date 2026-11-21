import { localDb } from '../db/localDb';
import { isCountedSale } from '../lib/reports';
import type { Id } from '../types';
import { accountApi, ApiError, BILLING_ENABLED, hasRefreshToken, loadStoredPass } from './account';
import { findLocalStore, type BootstrapResult } from './bootstrap';
import { avoidReceiptCodes, getDeviceId, getReceiptCode } from './device';
import { enqueueAll, getBinding, outcomeOf, setBinding, syncNow, type SyncOutcome } from './sync';
import { version } from '../../package.json';

/** Which store this device uses after sign-in (ADR-024, spec §3). */

export interface StoreFacts {
  name: string;
  products: number;
  orders: number;
  lastSaleAt: string | null;
}

export interface ServerStore {
  storeId: Id | null;
  summary: StoreFacts | null;
  profile: { storeName: string };
}

export type BootDecision =
  | { kind: 'ready' }
  | { kind: 'setup'; storeName: string }
  | { kind: 'download'; storeId: Id }
  | { kind: 'choose'; local: StoreFacts; remote: StoreFacts; remoteStoreId: Id }
  | { kind: 'otherAccount'; local: StoreFacts }
  | { kind: 'needOnline' };

export interface SyncDevice {
  deviceId: Id;
  name: string;
  receiptCode: string;
  firstSeen: number;
  lastSeen: number;
  appVersion: string;
}

export const DEVICES_KEY = 'sync.devices';

export async function accountId(): Promise<Id | null> {
  return (await loadStoredPass())?.sub ?? null;
}

const hello = async () => ({ deviceId: await getDeviceId(), receiptCode: await getReceiptCode(), appVersion: version });

export const fetchServerStore = () => accountApi<ServerStore>('GET', '/api/sync/store', undefined, true);

/** Counts for the choice screen, from this device's database. */
export async function localFacts(found: BootstrapResult): Promise<StoreFacts> {
  const storeId = found.store.id;
  const products = await localDb.products.where('storeId').equals(storeId).filter((p) => !p.deletedAt).count();
  const sales = await localDb.orders.where('storeId').equals(storeId).filter(isCountedSale).toArray();
  const lastSaleAt = sales.map((o) => o.createdAt).sort().at(-1) ?? null;
  return { name: found.store.name, products, orders: sales.length, lastSaleAt };
}

/** Saves the device list and moves off a receipt code an earlier device already uses. */
export async function rememberDevices(devices: SyncDevice[]): Promise<void> {
  const me = await getDeviceId();
  const mine = devices.find((d) => d.deviceId === me);
  const taken = new Set(devices.filter((d) => d.deviceId !== me && (!mine || d.firstSeen < mine.firstSeen)).map((d) => d.receiptCode));
  await avoidReceiptCodes(taken);
  await localDb.meta.put({ key: DEVICES_KEY, value: JSON.stringify(devices) });
}

export async function cachedDevices(): Promise<SyncDevice[]> {
  try {
    return JSON.parse((await localDb.meta.get(DEVICES_KEY))?.value ?? '[]') as SyncDevice[];
  } catch {
    return [];
  }
}

/**
 * Ties the account to this device's store when the account has none (or already has this one), then queues
 * everything for upload the first time. Returns 'mismatch' when the account already has another store.
 */
export async function claimStore(found: BootstrapResult, account: Id): Promise<'claimed' | 'mismatch'> {
  try {
    const r = await accountApi<{ devices: SyncDevice[] }>('POST', '/api/sync/claim', { storeId: found.store.id, ...(await hello()) }, true);
    const before = await getBinding();
    await setBinding({ accountId: account, storeId: found.store.id });
    if (!before || before.storeId !== found.store.id || before.accountId !== account) await enqueueAll();
    await rememberDevices(r.devices);
    return 'claimed';
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return 'mismatch';
    throw error;
  }
}

/** Decides what the app shows after sign-in. Offline with a store on the device → just sell. */
export async function decideBoot(found: BootstrapResult | null): Promise<BootDecision> {
  if (!BILLING_ENABLED || !hasRefreshToken()) return found ? { kind: 'ready' } : { kind: 'setup', storeName: '' };
  const account = await accountId();
  const binding = await getBinding();
  if (found && binding && binding.accountId === account && binding.storeId === found.store.id) return { kind: 'ready' };
  if (found && binding && binding.accountId !== account) return { kind: 'otherAccount', local: await localFacts(found) };

  let server: ServerStore;
  try {
    server = await fetchServerStore();
  } catch (error) {
    if (outcomeOf(error) === 'offline') return found ? { kind: 'ready' } : { kind: 'needOnline' };
    throw error;
  }
  if (!server.storeId) {
    if (!found) return { kind: 'setup', storeName: server.profile.storeName };
    if (account) await claimStore(found, account);
    return { kind: 'ready' };
  }
  if (!found) return { kind: 'download', storeId: server.storeId };
  if (server.storeId === found.store.id) {
    if (account) await claimStore(found, account);
    return { kind: 'ready' };
  }
  const remote = server.summary ?? { name: '', products: 0, orders: 0, lastSaleAt: null };
  return { kind: 'choose', local: await localFacts(found), remote, remoteStoreId: server.storeId };
}

/**
 * The background loop's step: claim if this device's store is not tied to the account yet, then sync.
 * Never throws; never runs while selling waits.
 */
export async function syncTick(): Promise<SyncOutcome> {
  if (!BILLING_ENABLED || !hasRefreshToken()) return 'unbound';
  try {
    if (!(await getBinding())) {
      const found = await findLocalStore();
      const account = await accountId();
      if (!found || !account) return 'unbound';
      if ((await claimStore(found, account)) === 'mismatch') return 'mismatch';
    }
  } catch (error) {
    return outcomeOf(error);
  }
  return syncNow();
}

/** Refreshes the device list (Settings, Kas). Errors leave the cached list. */
export async function refreshDevices(): Promise<SyncDevice[]> {
  try {
    const r = await accountApi<{ devices: SyncDevice[] }>('GET', '/api/sync/devices', undefined, true);
    await rememberDevices(r.devices);
    return r.devices;
  } catch {
    return cachedDevices();
  }
}

export async function renameDevice(deviceId: Id, name: string): Promise<SyncDevice[]> {
  const r = await accountApi<{ devices: SyncDevice[] }>('POST', '/api/sync/devices/name', { deviceId, name }, true);
  await rememberDevices(r.devices);
  return r.devices;
}

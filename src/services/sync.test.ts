import 'fake-indexeddb/auto';
import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryRepo } from '../../server/memoryRepo';
import { passSigner } from '../../server/pass';
import { route } from '../../server/router';
import { signUpOrIn } from '../../server/testSignup';
import type { Deps } from '../../server/types';
import { localDb } from '../db/localDb';
import { ensureLocalStore, findLocalStore, updateStore } from './bootstrap';
import { newMeta, saveProduct } from './catalog';
import type { Product } from '../types';
import { DEVICE_ID_KEY, getDeviceId, resetDeviceCache } from './device';
import { downloadStore } from './storeSwitch';
import { applyRemote, enqueueAll, getBinding, pendingCount, pullChanges, pushOutbox } from './sync';
import { claimStore } from './syncBinding';

/**
 * Two devices against the real server router (in memory): device A uploads its store, device B downloads it,
 * edits flow both ways with last write wins (ADR-024). One IndexedDB stands in for each device in turn.
 */

let account = '';
vi.mock('./account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./account')>()),
  loadStoredPass: async () => ({ sub: account, email: 'siti@warung.id', plan: 'trial', until: Date.now() + 1e9, iat: Date.now() }),
}));

const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: () => null,
  length: 0,
} as Storage;

let now = Date.now();
let deps: Deps;

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
  resetDeviceCache();
  storage.clear();
  now = Date.now();
  const kp = await generateKeyPair('ES256', { extractable: true });
  const repo = memoryRepo();
  deps = { repo, mailer: { sendLoginCode: async () => undefined }, signer: await passSigner({ ...(await exportJWK(kp.privateKey)), kid: 't' }), google: null, now: () => now, appOrigin: 'https://pikul.test', adminPassword: null, emailEnabled: false };
  const session = (await signUpOrIn(deps, 'siti@warung.id')).body as { refreshToken: string };
  storage.set('kk.refresh', session.refreshToken);
  account = (await repo.findAccountByEmail('siti@warung.id'))!.id;
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'https://pikul.test');
    const auth = new Headers(init?.headers).get('Authorization');
    const r = await route(deps, init?.method ?? 'GET', url.pathname, auth, typeof init?.body === 'string' ? init.body : '', { ip: '10.0.0.1', query: url.searchParams });
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
});

/** Leave the settle window so the server hands rows to other devices. */
const settle = () => {
  now += 5_000;
};

/** Become a fresh device: empty database, new device id. */
async function switchToNewDevice() {
  await localDb.delete();
  await localDb.open();
  resetDeviceCache();
}

async function deviceAWithMenu() {
  const found = await ensureLocalStore();
  await updateStore({ ...found.store, name: 'Warung Siti' });
  const kopi: Product = { ...newMeta(found.store.id), categoryId: null, name: 'Kopi', basePrice: 5_000, isActive: true, sortOrder: 0, variantGroupIds: [], modePrices: {} };
  await saveProduct(kopi);
  expect(await claimStore(found, account)).toBe('claimed');
  await pushOutbox((await getBinding())!);
  expect(await pendingCount()).toBe(0);
  return found;
}

describe('device sync (ADR-024)', () => {
  it('a second device downloads the store: name, owner and menu, without re-queuing them', async () => {
    const a = await deviceAWithMenu();
    settle();
    await switchToNewDevice();
    await downloadStore(a.store.id);
    const b = await findLocalStore();
    expect(b?.store).toMatchObject({ id: a.store.id, name: 'Warung Siti' });
    expect(b?.owner.id).toBe(a.owner.id);
    expect((await localDb.products.toArray()).map((p) => p.name)).toEqual(['Kopi']);
    expect(await pendingCount()).toBe(0);
    expect(await localDb.meta.get('legacySampleMenuRemovedAt')).toBeDefined();
  });

  it('a claim from a device with another store is refused', async () => {
    await deviceAWithMenu();
    await switchToNewDevice();
    const other = await ensureLocalStore();
    expect(await claimStore(other, account)).toBe('mismatch');
  });

  it('the first claim queues every record of an existing store', async () => {
    const found = await ensureLocalStore();
    await localDb.outbox.clear();
    await claimStore(found, account);
    expect(await pendingCount()).toBeGreaterThanOrEqual(4); // store, owner, sales modes, payment methods
  });

  it('an edit on B reaches A; an older remote copy never overwrites a newer local one', async () => {
    const a = await deviceAWithMenu();
    const aDevice = await getDeviceId();
    const aDump = await localDb.products.toArray();
    settle();
    await switchToNewDevice();
    await downloadStore(a.store.id);
    const kopi = (await localDb.products.toArray())[0]!;
    await saveProduct({ ...kopi, basePrice: 6_000 });
    await pushOutbox((await getBinding())!);
    settle();

    // Back on A (its product row as it was), pull B's edit.
    await switchToNewDevice();
    await localDb.meta.put({ key: DEVICE_ID_KEY, value: aDevice });
    await localDb.products.bulkPut(aDump);
    await localDb.meta.bulkPut([{ key: 'sync.accountId', value: account }, { key: 'sync.storeId', value: a.store.id }]);
    await pullChanges((await getBinding())!);
    expect((await localDb.products.get(kopi.id))?.basePrice).toBe(6_000);

    const newer = { ...kopi, basePrice: 7_000, updatedAt: new Date(now + 60_000).toISOString() };
    await localDb.products.put(newer);
    expect(await applyRemote([{ table: 'products', id: kopi.id, data: { ...kopi, basePrice: 6_000 } as unknown as Record<string, unknown> }])).toBe(0);
    expect((await localDb.products.get(kopi.id))?.basePrice).toBe(7_000);
  });

  it('enqueueAll includes the store row', async () => {
    await ensureLocalStore();
    await enqueueAll();
    expect((await localDb.outbox.toArray()).some((e) => e.table === 'stores')).toBe(true);
  });
});

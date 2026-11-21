import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { route } from './router';
import { checkRecord, PULL_SETTLE_MS, shouldApply } from './syncCheck';
import { signUpOrIn } from './testSignup';
import type { Deps } from './types';

const T0 = Date.UTC(2026, 10, 21, 3);
const STORE = '0193a000-0000-7000-8000-000000000001';
const OTHER_STORE = '0193a000-0000-7000-8000-000000000002';
const DEV_A = '0193a000-0000-7000-8000-00000000000a';
const DEV_B = '0193a000-0000-7000-8000-00000000000b';
const PRODUCT = '0193a000-0000-7000-8000-000000000101';
const ORDER = '0193a000-0000-7000-8000-000000000201';
let now = T0;
let deps: Deps;

beforeEach(async () => {
  now = T0;
  const kp = await generateKeyPair('ES256', { extractable: true });
  deps = {
    repo: memoryRepo(),
    mailer: { sendLoginCode: async () => undefined },
    signer: await passSigner({ ...(await exportJWK(kp.privateKey)), kid: 't1' }),
    google: null,
    now: () => now,
    appOrigin: 'https://pikul.test',
    adminPassword: null,
    emailEnabled: false,
  };
});

const call = (method: string, path: string, token: string | null, body?: unknown, query = '') =>
  route(deps, method, path, token ? `Bearer ${token}` : null, body === undefined ? '' : JSON.stringify(body), { ip: '10.0.0.1', query: new URLSearchParams(query) });
const tokenFor = async (email: string) => ((await signUpOrIn(deps, email)).body as { refreshToken: string }).refreshToken;
const iso = (ms: number) => new Date(ms).toISOString();
const product = (name: string, updatedAt: number, storeId = STORE) => ({
  table: 'products',
  id: PRODUCT,
  data: { id: PRODUCT, storeId, name, basePrice: 10_000, createdAt: iso(T0), updatedAt: iso(updatedAt) },
});
const order = (status: string, updatedAt: number) => ({ table: 'orders', id: ORDER, data: { id: ORDER, storeId: STORE, status, createdAt: iso(T0), updatedAt: iso(updatedAt) } });
const hello = (deviceId: string) => ({ deviceId, receiptCode: deviceId === DEV_A ? 'AB' : 'CD', appVersion: '0.19.0' });
const push = (token: string, deviceId: string, records: unknown[], storeId = STORE) => call('POST', '/api/sync/push', token, { storeId, ...hello(deviceId), records });
const pull = (token: string, deviceId: string, after = 0, storeId = STORE) => call('GET', '/api/sync/pull', token, undefined, `storeId=${storeId}&deviceId=${deviceId}&after=${after}`);
const pulled = (r: { body: unknown }) => r.body as { records: Array<{ table: string; id: string; data: Record<string, unknown> }>; cursor: number; more: boolean };

describe('sync API (ADR-024)', () => {
  it('needs a signed-in merchant', async () => {
    expect((await call('GET', '/api/sync/store', null)).status).toBe(401);
    expect((await push('0'.repeat(64), DEV_A, [])).status).toBe(401);
  });

  it('a new account has no store and returns the sign-up store name for setup', async () => {
    const token = await tokenFor('siti@warung.id');
    const r = await call('GET', '/api/sync/store', token);
    expect(r.body).toMatchObject({ storeId: null, summary: null, profile: { storeName: 'Toko siti' } });
  });

  it('the first device claims; another store is refused with the bound id', async () => {
    const token = await tokenFor('siti@warung.id');
    expect((await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) })).status).toBe(200);
    expect((await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_B) })).status).toBe(200);
    const other = await call('POST', '/api/sync/claim', token, { storeId: OTHER_STORE, ...hello(DEV_B) });
    expect(other).toMatchObject({ status: 409, body: { error: 'store_mismatch', storeId: STORE } });
    expect((await push(token, DEV_B, [], OTHER_STORE)).status).toBe(409);
    expect((await pull(token, DEV_B, 0, OTHER_STORE)).status).toBe(409);
  });

  it('push before a claim is refused as not_claimed', async () => {
    const token = await tokenFor('siti@warung.id');
    expect(await push(token, DEV_A, [product('Kopi', T0)])).toMatchObject({ status: 409, body: { error: 'not_claimed' } });
  });

  it("device B pulls what A pushed, never its own writes, only after the settle window", async () => {
    const token = await tokenFor('siti@warung.id');
    await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) });
    expect((await push(token, DEV_A, [product('Kopi', T0)])).body).toMatchObject({ saved: 1, rejected: [] });
    expect(pulled(await pull(token, DEV_B)).records).toHaveLength(0);
    now += PULL_SETTLE_MS;
    const b = pulled(await pull(token, DEV_B));
    expect(b.records.map((r) => r.data.name)).toEqual(['Kopi']);
    expect(pulled(await pull(token, DEV_A)).records).toHaveLength(0);
    expect(pulled(await pull(token, DEV_B, b.cursor)).records).toHaveLength(0);
  });

  it('last write wins by updatedAt; an older edit arriving late is ignored', async () => {
    const token = await tokenFor('siti@warung.id');
    await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) });
    await push(token, DEV_A, [product('Kopi Susu', T0 + 2_000)]);
    expect((await push(token, DEV_B, [product('Kopi', T0 + 1_000)])).body).toMatchObject({ saved: 0 });
    now += PULL_SETTLE_MS;
    expect(pulled(await pull(token, DEV_B)).records[0]?.data.name).toBe('Kopi Susu');
  });

  it('a paid order never goes back to open', async () => {
    const token = await tokenFor('siti@warung.id');
    await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) });
    await push(token, DEV_A, [order('paid', T0 + 1_000)]);
    expect((await push(token, DEV_B, [order('open', T0 + 5_000)])).body).toMatchObject({ saved: 0 });
    expect((await push(token, DEV_B, [order('void', T0 + 6_000)])).body).toMatchObject({ saved: 1 });
  });

  it('rejects bad records one by one and keeps the good ones', async () => {
    const token = await tokenFor('siti@warung.id');
    await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) });
    const r = await push(token, DEV_A, [product('Kopi', T0), product('Teh', T0, OTHER_STORE), { table: 'secrets', id: PRODUCT, data: {} }]);
    expect(r.body).toMatchObject({ saved: 1, rejected: [{ error: 'wrong_store' }, { error: 'invalid_table' }] });
  });

  it("one account can never read another account's store", async () => {
    const siti = await tokenFor('siti@warung.id');
    const budi = await tokenFor('budi@warung.id');
    await call('POST', '/api/sync/claim', siti, { storeId: STORE, ...hello(DEV_A) });
    await push(siti, DEV_A, [product('Kopi', T0)]);
    now += PULL_SETTLE_MS;
    expect((await pull(budi, DEV_B)).status).toBe(409);
    await call('POST', '/api/sync/claim', budi, { storeId: OTHER_STORE, ...hello(DEV_B) });
    expect(pulled(await pull(budi, DEV_B, 0, OTHER_STORE)).records).toHaveLength(0);
  });

  it('summary counts products and sales for the choice screen', async () => {
    const token = await tokenFor('siti@warung.id');
    await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) });
    await push(token, DEV_A, [product('Kopi', T0), order('paid', T0), { table: 'stores', id: STORE, data: { id: STORE, name: 'Warung Siti' } }]);
    const r = await call('GET', '/api/sync/store', token);
    expect(r.body).toMatchObject({ storeId: STORE, summary: { name: 'Warung Siti', products: 1, orders: 1, lastSaleAt: iso(T0) } });
  });

  it('replace needs the password, drops old records and rebinds', async () => {
    const token = await tokenFor('siti@warung.id');
    await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) });
    await push(token, DEV_A, [product('Kopi', T0)]);
    const wrong = await call('POST', '/api/sync/replace', token, { storeId: OTHER_STORE, password: 'salah-sekali', ...hello(DEV_B) });
    expect(wrong.status).toBe(403);
    const ok = await call('POST', '/api/sync/replace', token, { storeId: OTHER_STORE, password: 'rahasia-123', ...hello(DEV_B) });
    expect(ok.status).toBe(200);
    expect((await push(token, DEV_A, [product('Kopi', T0 + 1)])).body).toMatchObject({ error: 'store_mismatch', storeId: OTHER_STORE });
    expect((await call('GET', '/api/sync/store', token)).body).toMatchObject({ storeId: OTHER_STORE, summary: { products: 0 } });
  });

  it('lists devices with default names and renames them', async () => {
    const token = await tokenFor('siti@warung.id');
    await call('POST', '/api/sync/claim', token, { storeId: STORE, ...hello(DEV_A) });
    now += 1_000;
    await push(token, DEV_B, []);
    const list = (await call('GET', '/api/sync/devices', token)).body as { devices: Array<{ deviceId: string; name: string; receiptCode: string }> };
    expect(list.devices.map((d) => [d.name, d.receiptCode])).toEqual([['Perangkat 1', 'AB'], ['Perangkat 2', 'CD']]);
    const renamed = await call('POST', '/api/sync/devices/name', token, { deviceId: DEV_B, name: 'HP Kasir' });
    expect((renamed.body as typeof list).devices[1]?.name).toBe('HP Kasir');
    expect((await call('POST', '/api/sync/devices/name', token, { deviceId: DEV_B, name: '<b>' })).status).toBe(400);
  });
});

describe('checkRecord / shouldApply', () => {
  it('needs updatedAt except on the store row, and refuses far-future clocks', () => {
    expect(checkRecord({ table: 'stores', id: STORE, data: { id: STORE } }, STORE, T0).ok).toBe(true);
    expect(checkRecord({ table: 'products', id: PRODUCT, data: { id: PRODUCT, storeId: STORE } }, STORE, T0)).toEqual({ ok: false, error: 'invalid_updated_at' });
    expect(checkRecord(product('x', T0 + 2 * 86_400_000), STORE, T0)).toEqual({ ok: false, error: 'invalid_updated_at' });
    expect(checkRecord({ ...product('x', T0), id: ORDER }, STORE, T0)).toEqual({ ok: false, error: 'id_mismatch' });
  });
  it('equal timestamps mean "already have it"', () => {
    const r = checkRecord(product('x', T0), STORE, T0);
    expect(r.ok && shouldApply({ updatedAt: T0, status: null }, r.value)).toBe(false);
  });
});

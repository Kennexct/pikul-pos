import 'fake-indexeddb/auto';
import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryRepo } from '../../server/memoryRepo';
import { passSigner } from '../../server/pass';
import { route } from '../../server/router';
import { signUpOrIn } from '../../server/testSignup';
import type { Deps, ReceiptMail } from '../../server/types';
import { localDb } from '../db/localDb';
import { newMeta } from './catalog';
import { ensureLocalStore, updateStore } from './bootstrap';
import { resetDeviceCache } from './device';
import { claimStore } from './syncBinding';
import type { Order } from '../types';
import { flushReceipts, markShared, newReceiptToken, queueReceiptEmail } from './receiptShare';

/** Shared receipts against the real server router (ADR-028). The PNG is a stub: there is no canvas in Node. */

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
vi.mock('../lib/receiptImage', () => ({ receiptPng: async () => new Blob([PNG], { type: 'image/png' }) }));

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

let deps: Deps;
let mail: ReceiptMail[];
let repo: ReturnType<typeof memoryRepo>;

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
  resetDeviceCache();
  storage.clear();
  mail = [];
  const kp = await generateKeyPair('ES256', { extractable: true });
  repo = memoryRepo();
  deps = { repo, mailer: { sendLoginCode: async () => undefined, sendReceipt: async (m) => void mail.push(m) }, signer: await passSigner({ ...(await exportJWK(kp.privateKey)), kid: 't' }), google: null, now: Date.now, appOrigin: 'https://pikul.test', adminPassword: null, emailEnabled: true };
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

async function paidOrder(): Promise<Order> {
  const found = await ensureLocalStore();
  await updateStore({ ...found.store, name: 'Warung Siti' });
  const order: Order = {
    ...newMeta(found.store.id),
    receiptNo: 'INV-20261128-A001',
    status: 'paid',
    salesModeId: 'm1',
    salesModeNameSnapshot: 'Takeaway',
    customerId: null,
    customerNameSnapshot: 'Budi',
    label: '',
    items: [{ id: 'i1', productId: 'p1', nameSnapshot: 'Es kopi', unitPrice: 12_500, qty: 2, options: [], discount: null, note: '' }],
    orderDiscount: null,
    payments: [{ id: 'pay1', paymentMethodId: 'pm1', methodNameSnapshot: 'Tunai', methodType: 'cash', amount: 25_000, cashReceived: 30_000, change: 5_000 }],
    totals: { subtotal: 25_000, itemDiscountTotal: 0, orderDiscountTotal: 0, serviceTotal: 0, taxTotal: 0, grandTotal: 25_000 },
    cashierId: 'c1',
    businessDate: '2026-11-28',
    openedAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
  };
  await localDb.orders.put(order);
  return order;
}

describe('receipt share service', () => {
  it('makes 22-character url-safe tokens', () => {
    const a = newReceiptToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newReceiptToken()).not.toBe(a);
  });

  it('does nothing for a store that is not signed in', async () => {
    const order = await paidOrder();
    await markShared(order.id, newReceiptToken(), 'Siti');
    await flushReceipts();
    expect(repo.receipts.shares.size).toBe(0);
  });

  it('uploads once, keeps the first token, re-uploads after a void, and sends a queued email', async () => {
    const order = await paidOrder();
    expect(await claimStore(await ensureLocalStore(), account)).toBe('claimed');
    const token = newReceiptToken();
    expect(await markShared(order.id, token, 'Siti')).toBe(token);
    expect(await markShared(order.id, newReceiptToken(), 'Siti')).toBe(token);
    await flushReceipts();
    const first = repo.receipts.shares.get(token)!;
    expect(first.doc.shop.name).toBe('Warung Siti');
    expect(first.doc.banner).toBe('');
    expect(JSON.stringify(first.doc)).toContain('Es kopi');

    await localDb.orders.update(order.id, { status: 'void' });
    await flushReceipts();
    expect(repo.receipts.shares.get(token)!.doc.banner).toBe('Dibatalkan');

    await queueReceiptEmail(order.id, 'budi@mail.com', newReceiptToken(), 'Siti');
    await flushReceipts();
    expect(mail.map((m) => m.to)).toEqual(['budi@mail.com']);
    expect(await localDb.receiptEmails.count()).toBe(0);
  });
});

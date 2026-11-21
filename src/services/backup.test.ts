import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import { BackupError, backupFileName, parseBackup } from '../lib/backup';
import { createBackup, readBackupFile, restoreBackup } from './backup';
import { ensureLocalStore } from './bootstrap';
import { addExpense } from './expenses';
import { completeOrder } from './orders';

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
});

async function seedBusiness() {
  const { store, owner } = await ensureLocalStore();
  const salesMode = (await localDb.salesModes.where('storeId').equals(store.id).toArray()).find((m) => m.isDefault);
  const cash = (await localDb.paymentMethods.where('storeId').equals(store.id).toArray()).find((m) => m.type === 'cash');
  if (!salesMode || !cash) throw new Error('seed missing');
  const items = [{ id: 'i1', productId: 'p1', nameSnapshot: 'Bakso', unitPrice: 15_000, unitCost: 9_000, qty: 1, options: [], discount: null, note: '' }];
  await completeOrder({ openOrderId: null, items, orderDiscount: null, customerId: null, label: '' }, { store, salesMode, cashierId: owner.id }, { method: cash, amount: 15_000, cashReceived: 20_000 });
  await addExpense(store.id, { businessDate: '2026-11-19', category: 'ingredients', amount: 40_000, note: 'Daging', isFromDrawer: true, actorId: owner.id });
  await localDb.meta.put({ key: 'pinlock:owner', value: '{"failed":3}' });
  return store;
}

const dump = async () =>
  Object.fromEntries(await Promise.all(localDb.tables.filter((t) => t.name !== 'outbox').map(async (t) => [t.name, await t.toArray()] as const)));

describe('backup round trip', () => {
  it('restores every table exactly, minus the sync queue and PIN lockouts', async () => {
    const store = await seedBusiness();
    const before = await dump();
    const { blob, fileName, counts } = await createBackup(new Date(2026, 10, 19, 21, 30));
    expect(fileName).toBe(`pikul-cadangan-${store.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-20261119-2130.json`);
    expect(counts).toMatchObject({ stores: 1, orders: 1, expenses: 1 });

    // The device moves on (or is a different device): more sales, then restore the file.
    await localDb.orders.clear();
    await localDb.expenses.clear();
    await localDb.products.clear();
    const backup = await readBackupFile(blob);
    expect(backup).toMatchObject({ storeName: store.name, schemaVersion: localDb.verno });
    await restoreBackup(backup);

    const after = await dump();
    const portable = (rows: Array<{ key: string }> = []) => rows.filter((r) => !r.key.startsWith('pinlock:') && !['restoredAt', 'lastBackupAt'].includes(r.key));
    expect({ ...after, meta: portable(after.meta) }).toEqual({ ...before, meta: portable(before.meta) });
    const metaKeys = (after.meta ?? []).map((m: { key: string }) => m.key);
    expect(metaKeys).toEqual(expect.arrayContaining(['restoredAt', 'lastBackupAt']));
    expect(metaKeys).not.toContain('pinlock:owner');
    expect(await localDb.outbox.count()).toBe(0);
  });
});

describe('parseBackup rejects what it must', () => {
  const tables = ['stores', 'storeMembers', 'orders', 'meta'];
  const valid = {
    app: 'kasirku',
    formatVersion: 1,
    schemaVersion: 4,
    exportedAt: '2026-11-19T14:30:00.000Z',
    tables: { stores: [{ id: 's1', name: 'Warung' }], storeMembers: [{ id: 'm1', role: 'owner' }], orders: [], meta: [{ key: 'pinlock:x', value: '1' }], evil: [{ id: 'x' }] },
  };
  const parse = (file: unknown) => parseBackup(typeof file === 'string' ? file : JSON.stringify(file), 4, tables);

  it('accepts a valid file, drops unknown tables and lockout keys', () => {
    const backup = parse(valid);
    expect(Object.keys(backup.tables)).toEqual(tables);
    expect(backup.tables.meta).toEqual([]);
    expect(backup.storeName).toBe('Warung');
  });

  it.each([
    ['not JSON', 'hello', /rusak atau bukan/],
    ['another app', { ...valid, app: 'other' }, /bukan berkas cadangan/],
    ['no tables', { app: 'kasirku', formatVersion: 1, schemaVersion: 4 }, /bukan berkas cadangan/],
    ['newer schema', { ...valid, schemaVersion: 5 }, /versi aplikasi yang lebih baru/],
    ['newer format', { ...valid, formatVersion: 2 }, /versi aplikasi yang lebih baru/],
    ['rows without ids', { ...valid, tables: { ...valid.tables, orders: [{ total: 1 }] } }, /"orders" tidak terbaca/],
    ['table is not a list', { ...valid, tables: { ...valid.tables, orders: 'x' } }, /"orders" tidak terbaca/],
    ['two stores', { ...valid, tables: { ...valid.tables, stores: [{ id: 'a' }, { id: 'b' }] } }, /data toko/],
    ['no owner', { ...valid, tables: { ...valid.tables, storeMembers: [{ id: 'm1', role: 'cashier' }] } }, /data pemilik/],
  ])('%s', (_name, file, message) => {
    expect(() => parse(file)).toThrow(BackupError);
    expect(() => parse(file)).toThrow(message);
  });

  it('names files safely', () => {
    expect(backupFileName('Bakso "Pak Kumis" / Cab. 2', new Date(2026, 0, 5, 7, 3))).toBe('pikul-cadangan-bakso-pak-kumis-cab-2-20260105-0703.json');
  });
});

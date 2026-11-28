import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import type { OrderItem } from '../types';
import { ensureLocalStore } from './bootstrap';
import { deleteCustomer, saveCustomer, setCustomerEmail } from './customers';
import { completeOrder } from './orders';

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
});

const item: OrderItem = { id: 'i1', productId: 'p1', nameSnapshot: 'Bakso', unitPrice: 15_000, qty: 1, options: [], discount: null, note: '' };

describe('saveCustomer', () => {
  it('validates, normalises the phone and keeps it unique per store', async () => {
    const { store } = await ensureLocalStore();
    await expect(saveCustomer(store.id, { name: ' ', phone: '', note: '' })).rejects.toThrow(/wajib/);
    await expect(saveCustomer(store.id, { name: 'Bu Sari', phone: '12345', note: '' })).rejects.toThrow(/tidak valid/);

    const sari = await saveCustomer(store.id, { name: ' Bu Sari ', phone: '0812-3456-7890', note: 'langganan' });
    expect(sari).toMatchObject({ name: 'Bu Sari', phone: '+6281234567890', note: 'langganan' });
    await expect(saveCustomer(store.id, { name: 'Orang lain', phone: '+62 812 3456 7890', note: '' })).rejects.toThrow(/sudah dipakai oleh Bu Sari/);

    const renamed = await saveCustomer(store.id, { id: sari.id, name: 'Ibu Sari', phone: '081234567890', note: '' });
    expect(renamed).toMatchObject({ id: sari.id, name: 'Ibu Sari', createdAt: sari.createdAt });
    expect(renamed.note).toBeUndefined();
    expect(await saveCustomer(store.id, { name: 'Tanpa HP', phone: '', note: '' })).toMatchObject({ name: 'Tanpa HP' });
  });
});

describe('customer on orders', () => {
  it('snapshots the name, survives deletion, and deletion erases contact data', async () => {
    const { store, owner } = await ensureLocalStore();
    const salesMode = (await localDb.salesModes.where('storeId').equals(store.id).toArray()).find((m) => m.isDefault);
    const cash = (await localDb.paymentMethods.where('storeId').equals(store.id).toArray()).find((m) => m.type === 'cash');
    if (!salesMode || !cash) throw new Error('seed missing');
    const ctx = { store, salesMode, cashierId: owner.id };
    const pay = { method: cash, amount: 15_000, cashReceived: 15_000 };
    const sari = await saveCustomer(store.id, { name: 'Bu Sari', phone: '081234567890', note: 'alergi kacang' });

    const order = await completeOrder({ openOrderId: null, items: [item], orderDiscount: null, customerId: sari.id, label: '' }, ctx, pay);
    expect(order).toMatchObject({ customerId: sari.id, customerNameSnapshot: 'Bu Sari' });

    await deleteCustomer(sari.id);
    const stored = await localDb.customers.get(sari.id);
    expect(stored?.deletedAt).toBeTruthy();
    expect(stored?.phone).toBeUndefined();
    expect(stored?.note).toBeUndefined();
    expect((await localDb.orders.get(order.id))?.customerNameSnapshot).toBe('Bu Sari');
    await expect(deleteCustomer(sari.id)).rejects.toThrow(/tidak ditemukan/);

    const later = await completeOrder({ openOrderId: null, items: [item], orderDiscount: null, customerId: sari.id, label: '' }, ctx, pay);
    expect(later).toMatchObject({ customerId: null, customerNameSnapshot: null });
  });

  it('keeps an optional email for receipts (ADR-028) and erases it on delete', async () => {
    const { store } = await ensureLocalStore();
    await expect(saveCustomer(store.id, { name: 'Budi', phone: '', email: 'budi@', note: '' })).rejects.toThrow(/email tidak valid/);
    const budi = await saveCustomer(store.id, { name: 'Budi', phone: '', email: ' Budi@Mail.com ', note: '' });
    expect(budi.email).toBe('budi@mail.com');
    expect((await saveCustomer(store.id, { id: budi.id, name: 'Budi S', phone: '', note: '' })).email).toBe('budi@mail.com');
    await setCustomerEmail(budi.id, 'b2@mail.com');
    expect((await localDb.customers.get(budi.id))?.email).toBe('b2@mail.com');
    expect((await saveCustomer(store.id, { id: budi.id, name: 'Budi S', phone: '', email: '', note: '' })).email).toBeUndefined();
    await setCustomerEmail(budi.id, 'b3@mail.com');
    await deleteCustomer(budi.id);
    expect((await localDb.customers.get(budi.id))?.email).toBeUndefined();
  });
});

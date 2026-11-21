import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import { getBusinessDate } from '../lib/businessDate';
import type { OrderItem, PaymentMethod } from '../types';
import { ensureLocalStore } from './bootstrap';
import { cancelOpenOrder, completeOrder, saveOpenOrder, type CartSnapshot } from './orders';

const item: OrderItem = {
  id: 'i1',
  productId: 'p1',
  nameSnapshot: 'Bakso Urat',
  unitPrice: 15_000,
  qty: 2,
  options: [],
  discount: null,
  note: '',
};

const cart = (overrides: Partial<CartSnapshot> = {}): CartSnapshot => ({
  openOrderId: null,
  items: [item],
  orderDiscount: null,
  customerId: null,
  label: '',
  ...overrides,
});

async function setup() {
  const { store, owner } = await ensureLocalStore();
  const modes = await localDb.salesModes.where('storeId').equals(store.id).toArray();
  const methods = await localDb.paymentMethods.where('storeId').equals(store.id).toArray();
  const byType = (type: PaymentMethod['type']) => {
    const method = methods.find((m) => m.type === type);
    if (!method) throw new Error(`missing ${type}`);
    return method;
  };
  const salesMode = modes.find((m) => m.isDefault);
  if (!salesMode) throw new Error('missing default mode');
  return { ctx: { store, salesMode, cashierId: owner.id }, cash: byType('cash'), transfer: byType('transfer') };
}

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
});

describe('ensureLocalStore', () => {
  it('creates exactly one store even when called concurrently, with an empty menu (ADR-018)', async () => {
    const [a, b] = await Promise.all([ensureLocalStore(), ensureLocalStore()]);
    expect(a.store.id).toBe(b.store.id);
    expect(await localDb.stores.count()).toBe(1);
    expect([await localDb.products.count(), await localDb.categories.count(), await localDb.variantGroups.count(), await localDb.discounts.count()]).toEqual([0, 0, 0, 0]);
  });
});

describe('completeOrder', () => {
  it('records a paid cash order with change and queues it for sync', async () => {
    const { ctx, cash } = await setup();
    const outboxBefore = await localDb.outbox.count();
    const order = await completeOrder(cart(), ctx, { method: cash, amount: 30_000, cashReceived: 50_000 });

    expect(order.status).toBe('paid');
    expect(order.totals.grandTotal).toBe(30_000);
    expect(order.payments[0]?.change).toBe(20_000);
    expect(order.receiptNo).toMatch(/^INV-\d{8}-[A-Z0-9]{2}0001$/);
    expect(await localDb.outbox.count()).toBe(outboxBefore + 1);
  });

  it('increments receipt numbers per business day', async () => {
    const { ctx, cash } = await setup();
    const first = await completeOrder(cart(), ctx, { method: cash, amount: 30_000, cashReceived: 30_000 });
    const second = await completeOrder(cart(), ctx, { method: cash, amount: 30_000, cashReceived: 30_000 });
    expect(first.receiptNo.endsWith('0001')).toBe(true);
    expect(second.receiptNo.endsWith('0002')).toBe(true);
  });

  it('rejects short cash, empty cart and missing required reference', async () => {
    const { ctx, cash, transfer } = await setup();
    await expect(completeOrder(cart(), ctx, { method: cash, amount: 30_000, cashReceived: 10_000 })).rejects.toThrow(/kurang/);
    await expect(completeOrder(cart({ items: [] }), ctx, { method: cash, amount: 0, cashReceived: 0 })).rejects.toThrow(/kosong/);
    const strict = { ...transfer, referenceMode: 'required' as const };
    await expect(completeOrder(cart(), ctx, { method: strict, amount: 30_000 })).rejects.toThrow(/wajib/);
  });
});

describe('open orders', () => {
  it('saves, resumes with the same receipt number, then pays', async () => {
    const { ctx, cash } = await setup();
    await expect(saveOpenOrder(cart(), ctx)).rejects.toThrow(/label/);

    const open = await saveOpenOrder(cart({ label: 'Meja 5' }), ctx);
    expect(open.status).toBe('open');

    const paid = await completeOrder(cart({ openOrderId: open.id, label: 'Meja 5', items: [{ ...item, qty: 3 }] }), ctx, {
      method: cash,
      amount: 45_000,
      cashReceived: 50_000,
    });
    expect(paid.id).toBe(open.id);
    expect(paid.receiptNo).toBe(open.receiptNo);
    expect(paid.totals.grandTotal).toBe(45_000);

    await expect(completeOrder(cart({ openOrderId: open.id }), ctx, { method: cash, amount: 30_000, cashReceived: 30_000 })).rejects.toThrow(/berstatus Lunas/);
  });

  it('counts a saved order on the day it is paid, keeping its receipt number', async () => {
    const { ctx, cash } = await setup();
    const saved = await saveOpenOrder(cart({ label: 'Bon Bu Sari' }), ctx);
    await localDb.orders.update(saved.id, { businessDate: '2026-01-05' }); // saved days ago

    const paid = await completeOrder(cart({ openOrderId: saved.id, label: 'Bon Bu Sari' }), ctx, { method: cash, amount: 30_000, cashReceived: 30_000 });
    expect(paid.receiptNo).toBe(saved.receiptNo);
    expect(paid.businessDate).not.toBe('2026-01-05');
    expect(paid.businessDate).toBe(getBusinessDate(new Date(), ctx.store));
  });

  it('cancels with a reason and writes an audit event', async () => {
    const { ctx } = await setup();
    const open = await saveOpenOrder(cart({ label: 'Mas jaket merah' }), ctx);
    await expect(cancelOpenOrder(open.id, '  ', ctx.cashierId)).rejects.toThrow(/Alasan/);

    await cancelOpenOrder(open.id, 'Pelanggan batal', ctx.cashierId);
    expect((await localDb.orders.get(open.id))?.status).toBe('cancelled');
    const audit = await localDb.auditEvents.where('entityId').equals(open.id).first();
    expect(audit?.action).toBe('cancel_open_order');
  });
});

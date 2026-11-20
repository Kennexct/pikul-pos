import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import { getBusinessDate } from '../lib/businessDate';
import type { OrderItem } from '../types';
import { ensureLocalStore } from './bootstrap';
import { setProductSoldOut } from './catalog';
import { closeDay, getOpeningCash, hasOpening, reopenDay, setOpeningCash } from './dayClosing';
import { addExpense, deleteExpense } from './expenses';
import { completeOrder } from './orders';

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
});

const item: OrderItem = { id: 'i1', productId: 'p1', nameSnapshot: 'Bakso', unitPrice: 15_000, qty: 2, options: [], discount: null, note: '' };

async function setup() {
  const { store, owner } = await ensureLocalStore();
  const methods = await localDb.paymentMethods.where('storeId').equals(store.id).toArray();
  const salesMode = (await localDb.salesModes.where('storeId').equals(store.id).toArray()).find((m) => m.isDefault);
  const cash = methods.find((m) => m.type === 'cash');
  const qris = methods.find((m) => m.type === 'qris');
  if (!salesMode || !cash || !qris) throw new Error('seed missing');
  const ctx = { store, salesMode, cashierId: owner.id };
  const cart = { openOrderId: null, items: [item], orderDiscount: null, customerId: null, label: '' };
  return { store, owner, ctx, cart, cash, qris, today: getBusinessDate(new Date(), store) };
}

describe('expenses', () => {
  it('validates, saves, and soft-deletes with an audit event', async () => {
    const { store, owner, today } = await setup();
    const base = { businessDate: today, category: 'ingredients' as const, note: ' Es batu ', isFromDrawer: true, actorId: owner.id };
    await expect(addExpense(store.id, { ...base, amount: null })).rejects.toThrow(/Isi jumlah/);
    await expect(addExpense(store.id, { ...base, amount: -5 })).rejects.toThrow(/Isi jumlah/);
    await expect(addExpense(store.id, { ...base, amount: 10, note: 'x'.repeat(121) })).rejects.toThrow(/maksimal/);

    const expense = await addExpense(store.id, { ...base, amount: 20_000 });
    expect(expense).toMatchObject({ amount: 20_000, note: 'Es batu', isFromDrawer: true });
    await deleteExpense(expense.id, owner.id, null);
    expect((await localDb.expenses.get(expense.id))?.deletedAt).toBeTruthy();
    expect((await localDb.auditEvents.toArray()).map((e) => e.action)).toContain('expense_deleted');
    await expect(deleteExpense(expense.id, owner.id, null)).rejects.toThrow(/tidak ditemukan/);
  });
});

describe('closeDay', () => {
  it('stores the drawer figures, the difference, and resets sold-out items', async () => {
    const { store, owner, ctx, cart, cash, qris, today } = await setup();
    await setOpeningCash(store.id, today, 100_000, owner.id);
    await completeOrder(cart, ctx, { method: cash, amount: 30_000, cashReceived: 50_000 });
    await completeOrder(cart, ctx, { method: qris, amount: 30_000 });
    await addExpense(store.id, { businessDate: today, category: 'ingredients', amount: 12_000, note: '', isFromDrawer: true, actorId: owner.id });
    await addExpense(store.id, { businessDate: today, category: 'rent', amount: 500_000, note: '', isFromDrawer: false, actorId: owner.id });
    const product = await localDb.products.where('storeId').equals(store.id).first();
    if (!product) throw new Error('seed missing');
    await setProductSoldOut(product.id, true);

    const input = { storeId: store.id, businessDate: today, note: '', actorId: owner.id, shouldResetSoldOut: true };
    await expect(closeDay({ ...input, countedCash: null })).rejects.toThrow(/Isi jumlah/);
    const closing = await closeDay({ ...input, countedCash: 115_000 });

    expect(closing).toMatchObject({
      openingCash: 100_000,
      cashSales: 30_000,
      cashRefunds: 0,
      drawerExpenses: 12_000,
      expectedCash: 118_000,
      countedCash: 115_000,
      difference: -3_000,
      netSales: 60_000,
      transactions: 2,
      expensesTotal: 512_000,
    });
    expect((await localDb.products.get(product.id))?.isSoldOut).toBe(false);
    expect((await localDb.auditEvents.toArray()).map((e) => e.action)).toContain('day_closed');

    // One closing per day; opening cash is frozen while closed.
    await expect(closeDay({ ...input, countedCash: 118_000 })).rejects.toThrow(/sudah ditutup/);
    await expect(setOpeningCash(store.id, today, 0, owner.id)).rejects.toThrow(/sudah ditutup/);

    // Reopen (audited), then close again with the right count.
    await reopenDay(closing.id, owner.id, null);
    const again = await closeDay({ ...input, countedCash: 118_000 });
    expect(again.difference).toBe(0);
    expect(await localDb.dayClosings.count()).toBe(2);
    expect((await localDb.auditEvents.toArray()).map((e) => e.action)).toContain('day_reopened');
  });

  it('suggests the opening cash of the previous closing for a new day', async () => {
    const { store, owner } = await setup();
    await setOpeningCash(store.id, '2026-11-18', 150_000, owner.id);
    await closeDay({ storeId: store.id, businessDate: '2026-11-18', countedCash: 150_000, note: '', actorId: owner.id, shouldResetSoldOut: false });
    expect(await getOpeningCash(store.id, '2026-11-19')).toBe(150_000);
    expect(await getOpeningCash(store.id, '2026-11-17')).toBe(0);
  });

  it('opens the register once, then audits changes with the old and new amount', async () => {
    const { store, owner, today } = await setup();
    expect(await hasOpening(store.id, today)).toBe(false);
    await expect(setOpeningCash(store.id, today, -1, owner.id)).rejects.toThrow(/tidak valid/);
    await setOpeningCash(store.id, today, 0, owner.id);
    expect(await hasOpening(store.id, today)).toBe(true);
    await setOpeningCash(store.id, today, 75_000, owner.id);
    const events = await localDb.auditEvents.filter((e) => e.entity === 'register').toArray();
    expect(events.map((e) => e.action).sort()).toEqual(['opening_cash_changed', 'register_opened']);
    expect(events.find((e) => e.action === 'opening_cash_changed')?.payload).toMatchObject({ from: 0, to: 75_000 });
    expect(await getOpeningCash(store.id, today)).toBe(75_000);
  });
});

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDb } from '../db/localDb';
import { getBusinessDate } from '../lib/businessDate';
import type { OrderItem } from '../types';
import { ensureLocalStore } from './bootstrap';
import { seedSampleMenu } from '../test/sampleMenu';
import { setProductSoldOut } from './catalog';
import { closeDay, getClosings, getCurrentShiftNo, getOpeningCash, hasOpening, loadDrawerInput, reopenDay, setOpeningCash } from './dayClosing';
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
    await seedSampleMenu(store.id);
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

    // A closed shift is not closed twice; the next one has to be opened first (ADR-027).
    expect(closing.shiftNo).toBe(1);
    await expect(closeDay({ ...input, countedCash: 118_000 })).rejects.toThrow(/sudah ditutup/);

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

describe('shifts (ADR-027)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const at = (time: string) => vi.setSystemTime(new Date(`2026-11-25T${time}:00+07:00`));

  it('opens a new shift after a closing and never continues the closed one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    at('08:00');
    const { store, owner, ctx, cart, cash } = await setup();
    const today = getBusinessDate(new Date(), store);
    const close = (countedCash: number) => closeDay({ storeId: store.id, businessDate: today, countedCash, note: '', actorId: owner.id, shouldResetSoldOut: false });

    await setOpeningCash(store.id, today, 100_000, owner.id);
    await completeOrder(cart, ctx, { method: cash, amount: 30_000, cashReceived: 30_000 });
    at('14:05');
    const first = await close(130_000);
    expect(first).toMatchObject({ shiftNo: 1, openingCash: 100_000, cashSales: 30_000, expectedCash: 130_000 });

    // Shift 2: suggested opening = what shift 1 counted; it can be changed.
    at('15:00');
    expect(await getCurrentShiftNo(store.id, today)).toBe(2);
    expect(await hasOpening(store.id, today)).toBe(false);
    expect(await getOpeningCash(store.id, today)).toBe(130_000);
    await setOpeningCash(store.id, today, 120_000, owner.id);
    expect(await hasOpening(store.id, today)).toBe(true);
    await completeOrder(cart, ctx, { method: cash, amount: 30_000, cashReceived: 30_000 });
    await addExpense(store.id, { businessDate: today, category: 'ingredients', amount: 5_000, note: '', isFromDrawer: true, actorId: owner.id });

    // Shift 1 keeps its own figures; shift 2 only counts what happened after 14:05.
    expect((await loadDrawerInput(store.id, today, 1)).sales).toHaveLength(1);
    // The closed shift cannot be reopened once the next one started.
    await expect(reopenDay(first.id, owner.id, null)).rejects.toThrow(/Shift berikutnya/);

    at('21:00');
    const second = await close(145_000);
    expect(second).toMatchObject({ shiftNo: 2, openingCash: 120_000, cashSales: 30_000, drawerExpenses: 5_000, expectedCash: 145_000, difference: 0, transactions: 1 });
    expect((await getClosings(store.id, today)).map((c) => c.shiftNo)).toEqual([1, 2]);
    const opened = (await localDb.auditEvents.filter((e) => e.action === 'register_opened').toArray()).map((e) => e.payload);
    expect(opened).toEqual([expect.objectContaining({ shiftNo: 1 }), expect.objectContaining({ shiftNo: 2, openingCash: 120_000 })]);

    // The next day starts from the first shift's opening cash.
    expect(await getOpeningCash(store.id, '2026-11-26')).toBe(100_000);
  });

  it('lets the owner reopen the last shift while the next one has not started', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    at('08:00');
    const { store, owner } = await setup();
    const today = getBusinessDate(new Date(), store);
    await setOpeningCash(store.id, today, 50_000, owner.id);
    at('14:00');
    const first = await closeDay({ storeId: store.id, businessDate: today, countedCash: 50_000, note: '', actorId: owner.id, shouldResetSoldOut: false });
    at('14:10');
    await reopenDay(first.id, owner.id, null);
    expect(await getCurrentShiftNo(store.id, today)).toBe(1);
    expect(await hasOpening(store.id, today)).toBe(true);
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import { ensureLocalStore } from './bootstrap';
import { closeDay, getClosing, loadDrawerInput } from './dayClosing';
import { getDeviceId, resetDeviceCache } from './device';
import { completeOrder } from './orders';

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
  resetDeviceCache();
});

describe('cash register per device (ADR-025)', () => {
  it("another device's synced sale and closing never touch this drawer", async () => {
    const { store, owner } = await ensureLocalStore();
    const salesMode = (await localDb.salesModes.toArray()).find((m) => m.isDefault)!;
    const cash = (await localDb.paymentMethods.toArray()).find((m) => m.type === 'cash')!;
    const items = [{ id: 'i1', productId: 'p1', nameSnapshot: 'Bakso', unitPrice: 15_000, qty: 1, options: [], discount: null, note: '' }];
    const mine = await completeOrder({ openOrderId: null, items, orderDiscount: null, customerId: null, label: '' }, { store, salesMode, cashierId: owner.id }, { method: cash, amount: 15_000, cashReceived: 15_000 });
    expect(mine.deviceId).toBe(await getDeviceId());

    // A sale and a closing that arrived from device B through sync.
    await localDb.orders.put({ ...mine, id: 'other-order', receiptNo: 'X', deviceId: 'device-b', totals: { ...mine.totals, grandTotal: 99_000 }, payments: [{ ...mine.payments[0]!, amount: 99_000 }] });
    await localDb.dayClosings.put({ ...(await closeDayAs(store.id, owner.id, mine.businessDate)), id: 'other-closing', deviceId: 'device-b' });

    const input = await loadDrawerInput(store.id, mine.businessDate);
    expect(input.sales.map((o) => o.id)).toEqual([mine.id]);
    expect(await getClosing(store.id, mine.businessDate)).toBeUndefined();
  });
});

/** Builds a closing record (then removed for this device), used as device B's. */
async function closeDayAs(storeId: string, actorId: string, businessDate: string) {
  const c = await closeDay({ storeId, businessDate, countedCash: 0, note: '', actorId, shouldResetSoldOut: false });
  await localDb.dayClosings.delete(c.id);
  return c;
}

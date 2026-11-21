import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import { ensureLocalStore } from './bootstrap';
import { seedSampleMenu } from '../test/sampleMenu';
import { setProductSoldOut } from './catalog';

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
});

describe('setProductSoldOut', () => {
  it('flips only the sold-out flag and queues the change for sync', async () => {
    const { store } = await ensureLocalStore();
    await seedSampleMenu(store.id);
    const product = await localDb.products.where('storeId').equals(store.id).first();
    if (!product) throw new Error('seed missing');
    const queuedBefore = await localDb.outbox.count();

    await setProductSoldOut(product.id, true);
    const after = await localDb.products.get(product.id);
    expect(after).toMatchObject({ isSoldOut: true, isActive: product.isActive, basePrice: product.basePrice, name: product.name });
    expect(await localDb.outbox.count()).toBe(queuedBefore + 1);

    await setProductSoldOut(product.id, false);
    expect((await localDb.products.get(product.id))?.isSoldOut).toBe(false);
    await expect(setProductSoldOut('missing', true)).rejects.toThrow(/tidak ditemukan/);
  });
});

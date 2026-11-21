import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import { buildSampleMenu } from '../test/sampleMenu';
import type { Order } from '../types';
import { ensureLocalStore } from './bootstrap';
import { LEGACY_SAMPLE_REMOVED_KEY, removeLegacySampleMenu } from './legacySampleMenu';

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
});

/** A device set up before v0.17: the example menu shares the owner's creation time, and the cleanup has not run. */
async function legacyDevice() {
  const found = await ensureLocalStore();
  await localDb.meta.delete(LEGACY_SAMPLE_REMOVED_KEY);
  const sample = buildSampleMenu(found.store.id, 'takeaway');
  const stamp = <T extends { createdAt: string; updatedAt: string }>(rows: T[]): T[] => rows.map((r) => ({ ...r, createdAt: found.owner.createdAt, updatedAt: found.owner.createdAt }));
  await localDb.products.bulkPut(stamp(sample.products));
  await localDb.categories.bulkPut(stamp(sample.categories));
  await localDb.variantGroups.bulkPut(stamp(sample.variantGroups));
  await localDb.discounts.bulkPut(stamp(sample.discounts));
  return { ...found, sample };
}

const alive = async () => ({
  products: (await localDb.products.toArray()).filter((r) => !r.deletedAt).map((r) => r.name),
  categories: (await localDb.categories.toArray()).filter((r) => !r.deletedAt).map((r) => r.name),
  groups: (await localDb.variantGroups.toArray()).filter((r) => !r.deletedAt).map((r) => r.name),
  discounts: (await localDb.discounts.toArray()).filter((r) => !r.deletedAt).map((r) => r.name),
});

describe('removeLegacySampleMenu (ADR-018)', () => {
  it('soft-deletes an untouched example menu once, queues it for sync and writes one audit event', async () => {
    const device = await legacyDevice();
    const outboxBefore = await localDb.outbox.count();

    const removed = await removeLegacySampleMenu(device);
    expect(removed).toBe(device.sample.products.length + device.sample.categories.length + device.sample.variantGroups.length + 2);
    expect(await alive()).toEqual({ products: [], categories: [], groups: [], discounts: [] });
    expect(await localDb.outbox.count()).toBe(outboxBefore + removed + 1);
    expect(await localDb.auditEvents.filter((e) => e.action === 'sample_menu_removed').count()).toBe(1);

    expect(await removeLegacySampleMenu(device)).toBe(0); // runs once
  });

  it('keeps what the merchant edited or sold, and the categories and add-ons those still use', async () => {
    const device = await legacyDevice();
    const [edited, sold] = device.sample.products.filter((p) => p.variantGroupIds.length > 0);
    if (!edited || !sold) throw new Error('fixture changed');
    await localDb.products.put({ ...edited, basePrice: 20_000, updatedAt: new Date().toISOString() });
    const order = { id: 'o1', storeId: device.store.id, items: [{ productId: sold.id, discount: null }], orderDiscount: { discountId: device.sample.discounts[0]?.id } } as unknown as Order;
    await localDb.orders.put(order);
    const mine = { ...edited, id: 'mine', name: 'Menu saya', createdAt: new Date().toISOString() };
    await localDb.products.put(mine);

    await removeLegacySampleMenu(device);
    const left = await alive();
    expect(left.products.sort()).toEqual([edited.name, sold.name, 'Menu saya'].sort());
    expect(left.categories.length).toBeGreaterThan(0);
    expect(left.groups.length).toBeGreaterThan(0);
    expect(left.discounts).toEqual(['Promo Jumat']);
  });

  it('does nothing on a store created after v0.17', async () => {
    const found = await ensureLocalStore();
    expect(await removeLegacySampleMenu(found)).toBe(0);
    expect(await localDb.auditEvents.count()).toBe(0);
  });
});

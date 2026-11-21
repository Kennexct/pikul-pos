import { localDb } from '../db/localDb';
import { nowIso } from '../lib/id';
import type { Id, Order, Store, StoreMember, SyncMeta, SyncTable } from '../types';
import { writeAudit } from './audit';
import { saveAndQueue } from './sync';

export const LEGACY_SAMPLE_REMOVED_KEY = 'legacySampleMenuRemovedAt';

/** Up to v0.16 a new store came with an example menu and two example discounts, all stamped with the owner's creation time. */
const isUntouchedSeed = (row: SyncMeta, seededAt: string): boolean => !row.deletedAt && row.createdAt === seededAt && row.updatedAt === seededAt;

function usedIds(orders: readonly Order[]): { productIds: Set<Id>; discountIds: Set<Id> } {
  const productIds = new Set<Id>();
  const discountIds = new Set<Id>();
  for (const order of orders) {
    if (order.orderDiscount?.discountId) discountIds.add(order.orderDiscount.discountId);
    for (const item of order.items) {
      productIds.add(item.productId);
      if (item.discount?.discountId) discountIds.add(item.discount.discountId);
    }
  }
  return { productIds, discountIds };
}

/**
 * ADR-018: one-time cleanup of the example menu on devices set up before v0.17.
 * Soft-deletes only seed rows the merchant never edited and never sold; anything they touched stays.
 * Runs once per device; a failure never blocks opening the app (it retries on the next start).
 */
export async function removeLegacySampleMenu({ store, owner }: { store: Store; owner: StoreMember }): Promise<number> {
  try {
    if (await localDb.meta.get(LEGACY_SAMPLE_REMOVED_KEY)) return 0;
    const seededAt = owner.createdAt;
    const byStore = { storeId: store.id };
    const [products, categories, groups, discounts, orders] = await Promise.all([
      localDb.products.where(byStore).toArray(),
      localDb.categories.where(byStore).toArray(),
      localDb.variantGroups.where(byStore).toArray(),
      localDb.discounts.where(byStore).toArray(),
      localDb.orders.where(byStore).toArray(),
    ]);
    const used = usedIds(orders);

    const doomedProducts = products.filter((p) => isUntouchedSeed(p, seededAt) && !used.productIds.has(p.id));
    const doomedIds = new Set(doomedProducts.map((p) => p.id));
    const keptProducts = products.filter((p) => !p.deletedAt && !doomedIds.has(p.id));
    const keptCategoryIds = new Set(keptProducts.map((p) => p.categoryId));
    const keptGroupIds = new Set(keptProducts.flatMap((p) => p.variantGroupIds));

    const removals: Array<[SyncTable, SyncMeta[]]> = [
      ['products', doomedProducts],
      ['categories', categories.filter((c) => isUntouchedSeed(c, seededAt) && !keptCategoryIds.has(c.id))],
      ['variantGroups', groups.filter((g) => isUntouchedSeed(g, seededAt) && !keptGroupIds.has(g.id))],
      ['discounts', discounts.filter((d) => isUntouchedSeed(d, seededAt) && !used.discountIds.has(d.id))],
    ];
    const total = removals.reduce((sum, [, rows]) => sum + rows.length, 0);

    await localDb.transaction('rw', localDb.tables, async () => {
      const now = nowIso();
      for (const [table, rows] of removals) {
        for (const row of rows) await saveAndQueue(table, { ...row, deletedAt: now, updatedAt: now });
      }
      if (total > 0) {
        const counts = Object.fromEntries(removals.map(([table, rows]) => [table, rows.length]));
        await writeAudit({ storeId: store.id, actorId: owner.id, entity: 'store', entityId: store.id, action: 'sample_menu_removed', payload: counts });
      }
      await localDb.meta.put({ key: LEGACY_SAMPLE_REMOVED_KEY, value: now });
    });
    return total;
  } catch {
    return 0;
  }
}

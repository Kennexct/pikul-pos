import { localDb } from '../db/localDb';
import { nowIso } from '../lib/id';
import type { Category, Id } from '../types';
import { newMeta } from './catalog';
import { saveAndQueue } from './sync';
import { t } from '../i18n';

/** Category management for the Kategori tab (ADR-017). Owner-only through the Produk page gate. */
const NAME_MAX = 80;

const liveCategories = async (storeId: Id): Promise<Category[]> =>
  (await localDb.categories.where('storeId').equals(storeId).filter((c) => !c.deletedAt).toArray()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
  );

async function checkName(storeId: Id, name: string, exceptId: Id | null): Promise<string> {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed === '') throw new Error(t('{0} wajib diisi.', t('Nama kategori')));
  if (trimmed.length > NAME_MAX) throw new Error(t('{0} maksimal {1} karakter.', t('Nama kategori'), NAME_MAX));
  const taken = (await liveCategories(storeId)).some((c) => c.id !== exceptId && c.name.toLowerCase() === trimmed.toLowerCase());
  if (taken) throw new Error(t('"{0}" sudah ada.', trimmed));
  return trimmed;
}

/** New category at the end of the list. */
export async function createCategory(name: string, storeId: Id): Promise<Category> {
  const list = await liveCategories(storeId);
  const category: Category = { ...newMeta(storeId), name: await checkName(storeId, name, null), sortOrder: list.length };
  await saveAndQueue('categories', category);
  return category;
}

export async function renameCategory(id: Id, name: string): Promise<void> {
  const category = await localDb.categories.get(id);
  if (!category || category.deletedAt) throw new Error(t('Kategori tidak ditemukan.'));
  await saveAndQueue('categories', { ...category, name: await checkName(category.storeId, name, id), updatedAt: nowIso() });
}

/** Moves a category one place up (-1) or down (+1) and renumbers the list 0..n so old duplicate orders heal. */
export async function moveCategory(storeId: Id, id: Id, direction: -1 | 1): Promise<void> {
  await localDb.transaction('rw', localDb.categories, localDb.outbox, async () => {
    const list = await liveCategories(storeId);
    const from = list.findIndex((c) => c.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;
    const reordered = [...list];
    [reordered[from], reordered[to]] = [reordered[to] as Category, reordered[from] as Category];
    const now = nowIso();
    for (const [sortOrder, category] of reordered.entries()) {
      if (category.sortOrder !== sortOrder) await saveAndQueue('categories', { ...category, sortOrder, updatedAt: now });
    }
  });
}

/** Soft-deletes the category; its products move to "Tanpa kategori" in the same transaction. Returns how many moved. */
export async function deleteCategory(id: Id): Promise<number> {
  return localDb.transaction('rw', localDb.categories, localDb.products, localDb.outbox, async () => {
    const category = await localDb.categories.get(id);
    if (!category || category.deletedAt) throw new Error(t('Kategori tidak ditemukan.'));
    const now = nowIso();
    const products = await localDb.products.where('categoryId').equals(id).filter((p) => !p.deletedAt).toArray();
    for (const product of products) await saveAndQueue('products', { ...product, categoryId: null, updatedAt: now });
    await saveAndQueue('categories', { ...category, deletedAt: now, updatedAt: now });
    return products.length;
  });
}

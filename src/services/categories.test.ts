import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { localDb } from '../db/localDb';
import { ensureLocalStore } from './bootstrap';
import { createCategory, deleteCategory, moveCategory, renameCategory } from './categories';

beforeEach(async () => {
  await localDb.delete();
  await localDb.open();
});

const names = async (storeId: string) =>
  (await localDb.categories.where('storeId').equals(storeId).filter((c) => !c.deletedAt).toArray())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => c.name);

describe('categories', () => {
  it('creates at the end, trims, and refuses empty or duplicate names', async () => {
    const { store } = await ensureLocalStore();
    const before = await names(store.id);
    const created = await createCategory('  Gorengan  ', store.id);
    expect(created.name).toBe('Gorengan');
    expect(await names(store.id)).toEqual([...before, 'Gorengan']);
    await expect(createCategory(' ', store.id)).rejects.toThrow(/wajib/);
    await expect(createCategory('gorengan', store.id)).rejects.toThrow(/sudah ada/);
  });

  it('renames, allowing its own name in another case', async () => {
    const { store } = await ensureLocalStore();
    const a = await createCategory('Snack', store.id);
    await createCategory('Kopi', store.id);
    await renameCategory(a.id, 'SNACK');
    expect((await localDb.categories.get(a.id))?.name).toBe('SNACK');
    await expect(renameCategory(a.id, 'kopi')).rejects.toThrow(/sudah ada/);
    await expect(renameCategory('missing', 'X')).rejects.toThrow(/tidak ditemukan/);
  });

  it('moves up and down and ignores moves past the ends', async () => {
    const { store } = await ensureLocalStore();
    await localDb.categories.where('storeId').equals(store.id).delete();
    const a = await createCategory('A', store.id);
    await createCategory('B', store.id);
    const c = await createCategory('C', store.id);
    await moveCategory(store.id, c.id, -1);
    expect(await names(store.id)).toEqual(['A', 'C', 'B']);
    await moveCategory(store.id, a.id, -1);
    await moveCategory(store.id, a.id, 1);
    expect(await names(store.id)).toEqual(['C', 'A', 'B']);
  });

  it('deletes softly and moves its products to no category', async () => {
    const { store } = await ensureLocalStore();
    const category = await createCategory('Musiman', store.id);
    const product = await localDb.products.where('storeId').equals(store.id).first();
    if (!product) throw new Error('seed missing');
    await localDb.products.put({ ...product, categoryId: category.id });

    expect(await deleteCategory(category.id)).toBe(1);
    expect((await localDb.categories.get(category.id))?.deletedAt).toBeTruthy();
    expect((await localDb.products.get(product.id))?.categoryId).toBeNull();
    await expect(deleteCategory(category.id)).rejects.toThrow(/tidak ditemukan/);
    await expect(createCategory('Musiman', store.id)).resolves.toMatchObject({ name: 'Musiman' });
  });
});

import { localDb } from '../db/localDb';
import { nowIso, uuidv7 } from '../lib/id';
import type { Id, PaymentMethod, Product, SalesMode, SyncMeta, VariantGroup } from '../types';
import { saveAndQueue } from './sync';
import { t } from '../i18n';
import { SALE_UNITS } from '../lib/quantity';
import { hasVariants, validateVariants } from '../lib/productVariants';

const NAME_MAX = 80;

/** Sync metadata for a brand-new record: spread it into the object literal. */
export function newMeta(storeId: Id): SyncMeta {
  const now = nowIso();
  return { id: uuidv7(), storeId, createdAt: now, updatedAt: now };
}

function requireName(name: string, label: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error(t('{0} wajib diisi.', label));
  if (trimmed.length > NAME_MAX) throw new Error(t('{0} maksimal {1} karakter.', label, NAME_MAX));
}

function requirePrice(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(t('{0} tidak valid.', label));
}

export async function saveProduct(product: Product): Promise<void> {
  const variantError = validateVariants(product.variants ?? []);
  if (variantError) throw new Error(variantError);
  // ADR-012: the product's base price mirrors its cheapest variant so lists and older code paths stay sensible.
  if (hasVariants(product)) {
    const variants = (product.variants ?? []).map((v, sortOrder) => ({ ...v, name: v.name.trim(), sortOrder }));
    product = { ...product, variants, basePrice: Math.min(...variants.map((v) => v.price)) };
  }
  requireName(product.name, t('Nama produk'));
  requirePrice(product.basePrice, t('Harga dasar'));
  if (product.costPrice !== undefined) requirePrice(product.costPrice, t('Harga modal'));
  if (product.unit !== undefined && !SALE_UNITS.includes(product.unit)) throw new Error(t('Satuan tidak dikenal.'));
  Object.values(product.modePrices).forEach((price) => requirePrice(price, t('Harga mode')));
  await saveAndQueue('products', { ...product, name: product.name.trim(), updatedAt: nowIso() });
}

/** "Habis" switch (ADR-006): any seller can flip it from the cashier; it changes nothing else about the product. */
/** "Habis" for one variant (ADR-012). The product stays sellable while another variant is available. */
export async function setVariantSoldOut(productId: Id, variantId: Id, isSoldOut: boolean): Promise<void> {
  const product = await localDb.products.get(productId);
  const variant = product?.variants?.find((v) => v.id === variantId);
  if (!product || product.deletedAt || !variant) throw new Error(t('Produk tidak ditemukan.'));
  const variants = (product.variants ?? []).map((v) => (v.id === variantId ? { ...v, isSoldOut } : v));
  await saveAndQueue('products', { ...product, variants, updatedAt: nowIso() });
}

export async function setProductSoldOut(productId: Id, isSoldOut: boolean): Promise<void> {
  const product = await localDb.products.get(productId);
  if (!product || product.deletedAt) throw new Error(t('Produk tidak ditemukan.'));
  await saveAndQueue('products', { ...product, isSoldOut, updatedAt: nowIso() });
}

export async function saveVariantGroup(group: VariantGroup): Promise<void> {
  requireName(group.name, t('Nama grup add-on'));
  if (group.options.length === 0) throw new Error(t('Tambahkan minimal satu pilihan.'));
  group.options.forEach((option) => requireName(option.name, t('Nama pilihan')));
  if (group.max < 1) throw new Error(t('Maksimal pilihan minimal 1.'));
  const min = group.isRequired ? 1 : 0;
  const max = group.selectType === 'single' ? 1 : Math.min(group.max, group.options.length);
  await saveAndQueue('variantGroups', { ...group, name: group.name.trim(), min, max, updatedAt: nowIso() });
}

export async function savePaymentMethod(method: PaymentMethod): Promise<void> {
  requireName(method.name, t('Nama metode'));
  await saveAndQueue('paymentMethods', { ...method, updatedAt: nowIso() });
}

export async function saveSalesMode(mode: SalesMode): Promise<void> {
  requireName(mode.name, t('Nama mode'));
  if (mode.markupPct < 0 || mode.markupPct > 100) throw new Error(t('Markup harus 0–100%.'));
  await saveAndQueue('salesModes', { ...mode, updatedAt: nowIso() });
}

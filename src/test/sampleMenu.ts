import { localDb } from '../db/localDb';
import { nowIso, uuidv7 } from '../lib/id';
import type { Category, Discount, Id, Product, SyncMeta, VariantGroup } from '../types';

/**
 * TEST-ONLY sample menus. Never import this from app code (ADR-018: a new store starts empty).
 * Tests that need something to sell call `seedSampleMenu(storeId)` after `ensureLocalStore()`.
 */
export const SAMPLE_MENU_IDS = ['bakso', 'kopi', 'gorengan', 'warung'] as const;
export type SampleMenuId = (typeof SAMPLE_MENU_IDS)[number];

type GroupDef = { name: string; isRequired: boolean; max: number; options: ReadonlyArray<readonly [name: string, priceDelta: number]> };
/** name, category key, base price, takeaway price (null = same as base), variant group keys */
/** name, price, takeaway price (null = same) */
type VariantDef = readonly [name: string, price: number, takeawayPrice: number | null];
type ProductDef = readonly [name: string, category: string, basePrice: number, takeawayPrice: number | null, groups: readonly string[], variants?: readonly VariantDef[]];

interface TemplateDef {
  label: string;
  description: string;
  categories: Record<string, string>;
  groups: Record<string, GroupDef>;
  products: readonly ProductDef[];
}

const single = (name: string, options: GroupDef['options']): GroupDef => ({ name, isRequired: true, max: 1, options });
const PEDAS = single('Level Pedas', [['Tidak pedas', 0], ['Sedang', 0], ['Pedas', 0]]);

export const SAMPLE_MENUS: Record<SampleMenuId, TemplateDef> = {
  bakso: {
    label: 'Bakso & mie',
    description: 'Bakso, mie ayam, minuman',
    categories: { makanan: 'Makanan', minuman: 'Minuman' },
    groups: {
      pedas: PEDAS,
      topping: { name: 'Topping', isRequired: false, max: 3, options: [['Telur', 3_000], ['Tahu', 2_000], ['Pangsit', 2_000]] },
      ukuran: single('Ukuran', [['Reguler', 0], ['Jumbo', 3_000]]),
    },
    products: [
      ['Bakso Urat', 'makanan', 15_000, 16_000, ['pedas', 'topping']],
      ['Mie Ayam', 'makanan', 13_000, 14_000, ['pedas', 'topping']],
      ['Bakso Campur', 'makanan', 18_000, 19_000, ['pedas']],
      ['Kerupuk', 'makanan', 2_000, null, []],
      ['Es Teh', 'minuman', 5_000, 6_000, ['ukuran']],
      ['Es Jeruk', 'minuman', 7_000, 8_000, ['ukuran']],
      ['Air Mineral', 'minuman', 4_000, null, []],
    ],
  },
  kopi: {
    label: 'Kopi & minuman',
    description: 'Kedai kopi, es, camilan',
    categories: { kopi: 'Kopi', nonkopi: 'Non-kopi', camilan: 'Camilan' },
    // ADR-012: drinks have variants (each its own price); ice, sugar and size are add-ons.
    groups: {
      es: single('Es', [['Es normal', 0], ['Sedikit es', 0], ['Tanpa es', 0], ['Panas', 0]]),
      gula: single('Gula', [['Gula normal', 0], ['Sedikit gula', 0], ['Tanpa gula', 0]]),
      ukuran: single('Ukuran', [['Tall', 0], ['Grande', 4_000], ['Venti', 7_000]]),
    },
    products: [
      ['Kopi', 'kopi', 15_000, null, ['es', 'gula', 'ukuran'], [
        ['Americano', 18_000, 19_000],
        ['Latte', 25_000, 26_000],
        ['Cappuccino', 25_000, 26_000],
        ['Espresso', 15_000, 16_000],
        ['Kopi Susu Gula Aren', 20_000, 21_000],
      ]],
      ['Teh', 'nonkopi', 15_000, null, ['es', 'gula', 'ukuran'], [
        ['Teh Tarik', 15_000, 16_000],
        ['Lemon Tea', 15_000, 16_000],
        ['Matcha Latte', 25_000, 26_000],
      ]],
      ['Cokelat', 'nonkopi', 22_000, 23_000, ['es', 'gula', 'ukuran']],
      ['Roti Bakar', 'camilan', 15_000, null, []],
      ['Kentang Goreng', 'camilan', 15_000, null, []],
    ],
  },
  gorengan: {
    label: 'Gorengan & jajanan',
    description: 'Gorengan, kue, minuman',
    categories: { gorengan: 'Gorengan', minuman: 'Minuman' },
    groups: {},
    products: [
      ['Tahu Isi', 'gorengan', 2_000, null, []],
      ['Tempe Mendoan', 'gorengan', 2_000, null, []],
      ['Bakwan', 'gorengan', 2_000, null, []],
      ['Pisang Goreng', 'gorengan', 2_500, null, []],
      ['Cireng', 'gorengan', 2_000, null, []],
      ['Risoles', 'gorengan', 3_000, null, []],
      ['Es Teh', 'minuman', 4_000, null, []],
      ['Air Mineral', 'minuman', 4_000, null, []],
    ],
  },
  warung: {
    label: 'Warung makan',
    description: 'Nasi, lauk, minuman',
    categories: { nasi: 'Nasi & lauk', minuman: 'Minuman' },
    groups: {
      pedas: PEDAS,
      nasi: single('Porsi nasi', [['Biasa', 0], ['Setengah', 0], ['Tambah nasi', 3_000]]),
    },
    products: [
      ['Nasi Ayam Goreng', 'nasi', 18_000, 19_000, ['nasi', 'pedas']],
      ['Nasi Lele', 'nasi', 17_000, 18_000, ['nasi', 'pedas']],
      ['Nasi Rames', 'nasi', 15_000, 16_000, ['nasi']],
      ['Nasi Telur', 'nasi', 12_000, 13_000, ['nasi', 'pedas']],
      ['Sayur', 'nasi', 5_000, null, []],
      ['Tempe / Tahu', 'nasi', 2_000, null, []],
      ['Es Teh', 'minuman', 4_000, null, []],
      ['Teh Hangat', 'minuman', 3_000, null, []],
    ],
  },
};


export interface SampleMenu {
  categories: Category[];
  variantGroups: VariantGroup[];
  products: Product[];
  discounts: Discount[];
}

/** Builds a sample menu for a store; `takeawayModeId` gets the takeaway prices. */
export function buildSampleMenu(storeId: Id, takeawayModeId: Id, menu: SampleMenuId = 'bakso'): SampleMenu {
  const now = nowIso();
  const meta = (): SyncMeta => ({ id: uuidv7(), storeId, createdAt: now, updatedAt: now });
  const template = SAMPLE_MENUS[menu];

  const categories = new Map(Object.entries(template.categories).map(([key, name], sortOrder) => [key, { ...meta(), name, sortOrder } satisfies Category]));
  const groups = new Map(
    Object.entries(template.groups).map(([key, def]) => {
      const group: VariantGroup = {
        ...meta(),
        name: def.name,
        isRequired: def.isRequired,
        selectType: def.max === 1 ? 'single' : 'multi',
        min: def.isRequired ? 1 : 0,
        max: def.max,
        options: def.options.map(([name, priceDelta], sortOrder) => ({ id: uuidv7(), name, priceDelta, sortOrder })),
      };
      return [key, group] as const;
    }),
  );

  const products = template.products.map(([name, category, basePrice, takeawayPrice, groupKeys, variantDefs], sortOrder): Product => ({
    ...meta(),
    ...(variantDefs
      ? {
          variants: variantDefs.map(([variantName, price, variantTakeaway], variantOrder) => ({
            id: uuidv7(),
            name: variantName,
            price,
            ...(variantTakeaway === null ? {} : { modePrices: { [takeawayModeId]: variantTakeaway } }),
            sortOrder: variantOrder,
          })),
        }
      : {}),
    categoryId: categories.get(category)?.id ?? null,
    name,
    basePrice: variantDefs ? Math.min(...variantDefs.map(([, price]) => price)) : basePrice,
    isActive: true,
    sortOrder,
    variantGroupIds: groupKeys.flatMap((key) => groups.get(key)?.id ?? []),
    modePrices: takeawayPrice === null ? {} : { [takeawayModeId]: takeawayPrice },
  }));

  return {
    categories: [...categories.values()],
    variantGroups: [...groups.values()],
    products,
    discounts: [
      { ...meta(), name: 'Promo Jumat', scope: 'order', type: 'percent', value: 10, isActive: true },
      { ...meta(), name: 'Potongan Langganan', scope: 'order', type: 'fixed', value: 2_000, isActive: true },
    ],
  };
}

/** Writes a sample menu straight into the local database for a test. */
export async function seedSampleMenu(storeId: Id, menu: SampleMenuId = 'bakso'): Promise<SampleMenu> {
  const takeaway = await localDb.salesModes.where('storeId').equals(storeId).filter((m) => m.name === 'Takeaway').first();
  const sample = buildSampleMenu(storeId, takeaway?.id ?? 'takeaway', menu);
  await localDb.categories.bulkPut(sample.categories);
  await localDb.variantGroups.bulkPut(sample.variantGroups);
  await localDb.products.bulkPut(sample.products);
  await localDb.discounts.bulkPut(sample.discounts);
  return sample;
}

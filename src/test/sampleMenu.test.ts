import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSampleMenu, SAMPLE_MENU_IDS, SAMPLE_MENUS } from './sampleMenu';

describe('test-only sample menus', () => {
  it('e2e/fixtures/sample-menus.json mirrors src/test/sampleMenu.ts', () => {
    const json = JSON.parse(fs.readFileSync('e2e/fixtures/sample-menus.json', 'utf8')) as unknown;
    const expected = Object.fromEntries(Object.entries(SAMPLE_MENUS).map(([k, v]) => [k, { categories: v.categories, groups: v.groups, products: v.products }]));
    expect(json).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it.each(SAMPLE_MENU_IDS)('%s: every product points at a category and add-on groups that exist', (menu) => {
    const sample = buildSampleMenu('store', 'takeaway', menu);
    const categoryIds = new Set(sample.categories.map((c) => c.id));
    const groupIds = new Set(sample.variantGroups.map((g) => g.id));
    for (const product of sample.products) {
      expect(product.categoryId && categoryIds.has(product.categoryId)).toBe(true);
      expect(product.variantGroupIds.every((id) => groupIds.has(id))).toBe(true);
    }
  });
});

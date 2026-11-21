import { describe, expect, it } from 'vitest';
import { buildStoreBundle, DEFAULT_SETUP } from './storeSetup';

describe('new store (ADR-018)', () => {
  it('starts with an empty menu and no discounts, but can take payment', () => {
    const bundle = buildStoreBundle();
    expect(Object.keys(bundle).sort()).toEqual(['owner', 'paymentMethods', 'salesModes', 'store']);
    expect(bundle.paymentMethods.map((m) => m.type)).toEqual(['cash', 'qris', 'transfer']);
    expect(bundle.salesModes.filter((m) => m.isDefault)).toHaveLength(1);
  });

  it('applies the merchant choices: name, payment methods, QRIS image', () => {
    const bundle = buildStoreBundle({ storeName: '  Kopi Senja  ', hasQris: true, hasTransfer: false, qrisImageUrl: 'data:image/webp;base64,AAAA' });
    expect(bundle.store.name).toBe('Kopi Senja');
    expect(bundle.paymentMethods.map((m) => m.type)).toEqual(['cash', 'qris']);
    expect(bundle.paymentMethods.find((m) => m.type === 'qris')?.qrisImageUrl).toContain('data:image/webp');
    expect(buildStoreBundle({ ...DEFAULT_SETUP, storeName: ' ', hasQris: false, hasTransfer: false })).toMatchObject({ store: { name: 'Warung Saya' }, paymentMethods: [{ type: 'cash' }] });
  });
});

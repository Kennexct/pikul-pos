import { DEFAULT_PAYMENT_METHODS, DEFAULT_STORE_RULES } from '../constants';
import { nowIso, uuidv7 } from '../lib/id';
import type { PaymentMethod, SalesMode, Store, StoreMember, SyncMeta } from '../types';
import { t } from '../i18n';

/**
 * What a brand-new store starts with (ADR-009, ADR-018): the store, its owner, sales modes and payment methods.
 * No menu, no categories, no discounts — the merchant enters their own. Nothing here is example data.
 */
export interface StoreBundle {
  store: Store;
  owner: StoreMember;
  salesModes: SalesMode[];
  paymentMethods: PaymentMethod[];
}

export interface StoreSetup {
  storeName: string;
  hasQris: boolean;
  hasTransfer: boolean;
  qrisImageUrl?: string;
}

export const DEFAULT_SETUP: StoreSetup = { storeName: t('Warung Saya'), hasQris: true, hasTransfer: true };
export const STORE_NAME_MAX = 60;

export function buildStoreBundle(setup: StoreSetup = DEFAULT_SETUP): StoreBundle {
  const storeId = uuidv7();
  const now = nowIso();
  const meta = (): SyncMeta => ({ id: uuidv7(), storeId, createdAt: now, updatedAt: now });

  const store: Store = {
    id: storeId,
    name: setup.storeName.trim().slice(0, STORE_NAME_MAX) || DEFAULT_SETUP.storeName,
    address: '',
    phone: '',
    timezone: 'Asia/Jakarta',
    dayCutoff: '04:00',
    receiptHeader: '',
    receiptFooter: t('Terima kasih, sampai jumpa lagi!'),
    receiptPaperMm: 58,
    taxPct: 0,
    servicePct: 0,
    isTaxInclusive: false,
    settings: { ...DEFAULT_STORE_RULES },
  };
  const owner: StoreMember = { ...meta(), userId: null, role: 'owner', displayName: t('Pemilik'), pinHash: '' };

  const mode = (name: string, sortOrder: number, rest: Pick<SalesMode, 'isDefault' | 'isActive' | 'priceRule' | 'markupPct'>): SalesMode => ({ ...meta(), name, sortOrder, ...rest });
  const salesModes = [
    mode('Dine In', 0, { isDefault: true, isActive: true, priceRule: 'none', markupPct: 0 }),
    mode('Takeaway', 1, { isDefault: false, isActive: true, priceRule: 'mode_price', markupPct: 0 }),
    mode('GoFood/Grab', 2, { isDefault: false, isActive: false, priceRule: 'markup', markupPct: 20 }),
  ];

  const wanted = DEFAULT_PAYMENT_METHODS.filter((m) => m.type === 'cash' || (m.type === 'qris' && setup.hasQris) || (m.type === 'transfer' && setup.hasTransfer));
  const paymentMethods = wanted.map((m, sortOrder): PaymentMethod => ({
    ...meta(),
    name: m.name,
    type: m.type,
    referenceMode: m.referenceMode,
    referenceLabel: m.referenceLabel,
    ...(m.type === 'qris' && setup.qrisImageUrl ? { qrisImageUrl: setup.qrisImageUrl } : {}),
    isActive: true,
    sortOrder,
  }));

  return { store, owner, salesModes, paymentMethods };
}

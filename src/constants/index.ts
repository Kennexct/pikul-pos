import type { ExpenseCategory, OrderStatus, PaymentType, RefundReason, StoreRules } from '../types';
import { t } from '../i18n';

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  cash: t('Tunai'),
  qris: t('QRIS'),
  transfer: t('Transfer'),
  ewallet: t('E-wallet'),
  other: t('Lainnya'),
};

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  wrong_input: t('Salah input'),
  customer_cancel: t('Pelanggan batal'),
  out_of_stock: t('Produk habis'),
  other: t('Lainnya'),
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  open: t('Belum dibayar'),
  paid: t('Lunas'),
  void: t('Void'),
  refunded: t('Direfund'),
  partial_refund: t('Refund sebagian'),
  cancelled: t('Dibatalkan'),
};

export const APP_NAME = 'Pikul';
export const LOCALE = 'id-ID';
export const CURRENCY = 'IDR';

export const MAX_PAYMENTS_PER_ORDER = 2;
export const MAX_EXPORT_RANGE_DAYS = 366;
export const CLIENT_EXPORT_MAX_DAYS = 31;
export const LOCAL_HISTORY_DAYS = 30;

export const PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_OUTPUT_BYTES = 200 * 1024;
export const PHOTO_MAX_DIMENSION_PX = 600;

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
/** ADR-003: PBKDF2-HMAC-SHA-256 work factor for PIN and recovery-code hashes. */
export const PIN_PBKDF2_ITERATIONS = 150_000;
export const PIN_FREE_ATTEMPTS = 5;
/** Wait after the 5th, 6th, 7th, 8th+ consecutive wrong PIN. */
export const PIN_LOCK_STEPS_MS = [30_000, 60_000, 300_000, 900_000] as const;
/** ADR-004: owner powers re-lock this long after last use; one-time approvals expire after the same time. */
export const OWNER_UNLOCK_MS = 5 * 60_000;
/** Legacy identifier, frozen (ADR-016): renaming it signs every device out of its seller. */
export const ACTIVE_MEMBER_STORAGE_KEY = 'kasirku-active-member';
export const MEMBER_NAME_MAX = 40;
export const CONFIG_NAME_MAX = 40;
export const MAX_PAYMENT_METHODS = 12;
export const MAX_SALES_MODES = 8;

export const SYNC_INTERVAL_MS = 15_000;
export const SYNC_BATCH_SIZE = 100;
export const SYNC_MAX_ATTEMPTS = 10;

export const PERCENT_MAX = 100;

export const DEFAULT_STORE_RULES: StoreRules = {
  voidPermission: 'cashier_with_pin',
  refundPermission: 'owner_only',
  refundWindowDays: 7,
  cashierMaxDiscountPct: 20,
  isReasonRequired: true,
  shouldAutoShowReceipt: true,
} as const;

export const DEFAULT_SALES_MODES = ['Dine In', 'Takeaway'] as const;

export const DEFAULT_PAYMENT_METHODS = [
  { name: t('Tunai'), type: 'cash', referenceMode: 'off', referenceLabel: '' },
  { name: 'QRIS', type: 'qris', referenceMode: 'optional', referenceLabel: t('No. Ref') },
  { name: t('Transfer Bank'), type: 'transfer', referenceMode: 'optional', referenceLabel: t('4 digit terakhir') },
] as const;

/** Quick cash buttons shown on the payment screen. */
export const QUICK_CASH_AMOUNTS = [10_000, 20_000, 50_000, 100_000] as const;

/** ADR-013: the POS lives under /app; the landing page is at /. */
export const APP_BASE = '/app';

export const ROUTES = {
  login: '/login',
  pos: '/',
  openOrders: '/pesanan',
  history: '/riwayat',
  reports: '/laporan',
  products: '/produk',
  customers: '/pelanggan',
  cash: '/kas',
  help: '/bantuan',
  settings: '/pengaturan',
  more: '/lainnya',
} as const;

/** Order shown in the expense form. "ingredients" is the only cost-of-goods category (ADR-007). */
export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = ['ingredients', 'supplies', 'wages', 'utilities', 'rent', 'transport', 'other'];
export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  ingredients: t('Belanja bahan'),
  supplies: t('Kemasan & perlengkapan'),
  wages: t('Gaji & upah'),
  utilities: t('Listrik, gas, air'),
  rent: t('Sewa tempat'),
  transport: t('Transportasi'),
  other: t('Lainnya'),
};
export const EXPENSE_NOTE_MAX = 120;
export const MAX_EXPENSE_AMOUNT = 1_000_000_000;
export const CLOSING_NOTE_MAX = 200;
export const CLOSING_HISTORY_LIMIT = 60;

/** Marker inside backup files. Legacy identifier, frozen (ADR-016): old backups must keep restoring. */
export const BACKUP_APP_ID = 'kasirku';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_MAX_BYTES = 200 * 1024 * 1024;
export const LAST_BACKUP_KEY = 'lastBackupAt';
export const RESTORED_AT_KEY = 'restoredAt';

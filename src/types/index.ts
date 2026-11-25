/**
 * Pikul domain types — single source of truth for client, local DB and sync.
 * Money is ALWAYS integer Rupiah (no decimals). IDs are client-generated UUIDv7.
 */

export type Id = string;
export type Rupiah = number;
/** ISO-8601 timestamp string (UTC). */
export type IsoDateTime = string;
/** Business date in store timezone, YYYY-MM-DD. */
export type BusinessDate = string;

export const ROLES = ['owner', 'cashier'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = ['open', 'paid', 'void', 'refunded', 'partial_refund', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_TYPES = ['cash', 'qris', 'transfer', 'ewallet', 'other'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const REFERENCE_MODES = ['off', 'optional', 'required'] as const;
export type ReferenceMode = (typeof REFERENCE_MODES)[number];

export const PRICE_RULES = ['none', 'mode_price', 'markup'] as const;
export type PriceRule = (typeof PRICE_RULES)[number];

export const DISCOUNT_TYPES = ['percent', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_SCOPES = ['item', 'order'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];

export const REFUND_KINDS = ['void', 'refund'] as const;
export type RefundKind = (typeof REFUND_KINDS)[number];

export const REFUND_REASONS = ['wrong_input', 'customer_cancel', 'out_of_stock', 'other'] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const PERMISSION_LEVELS = ['owner_only', 'cashier_with_pin', 'cashier'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/** Fields every synced record carries. */
export interface SyncMeta {
  id: Id;
  storeId: Id;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt?: IsoDateTime | null;
  /** Cash records only (orders, refunds, expenses, closings): the device whose drawer they belong to (ADR-026). */
  deviceId?: Id;
}

export interface Store {
  id: Id;
  /** Set on every save since v0.19 so device sync can pick the latest (ADR-025). */
  updatedAt?: IsoDateTime;
  name: string;
  address: string;
  phone: string;
  logoUrl?: string;
  timezone: 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura';
  /** HH:mm — orders before this time count toward the previous business day. */
  dayCutoff: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptPaperMm: 58 | 80;
  /** Start of every receipt number, e.g. "BKS" → BKS-20261123-A10001. Absent = "INV". */
  receiptPrefix?: string;
  taxPct: number;
  servicePct: number;
  isTaxInclusive: boolean;
  settings: StoreRules;
}

export interface StoreRules {
  voidPermission: PermissionLevel;
  refundPermission: PermissionLevel;
  refundWindowDays: number;
  cashierMaxDiscountPct: number;
  isReasonRequired: boolean;
  shouldAutoShowReceipt: boolean;
  /** Shows "Dijual per" (kg, ons, liter…) in the product form (ADR-011). Absent on older stores = off. */
  isWeightSaleEnabled?: boolean;
}

/** What one unit of quantity means. `pcs` = pieces (whole numbers); the rest are measured (decimals). */
export type SaleUnit = 'pcs' | 'kg' | 'ons' | 'g' | 'l' | 'm';

export interface StoreMember extends SyncMeta {
  userId: Id | null;
  role: Role;
  displayName: string;
  /** `pbkdf2-sha256$<iterations>$<salt>$<hash>` (ADR-003); empty string = no PIN set. Never the PIN itself. */
  pinHash: string;
  /** Owner only: hash of the one-time recovery code shown when the PIN was set. */
  recoveryHash?: string;
}

export interface Category extends SyncMeta {
  name: string;
  sortOrder: number;
}

export interface Product extends SyncMeta {
  categoryId: Id | null;
  name: string;
  basePrice: Rupiah;
  /** Sold by weight or measure; prices and cost are per this unit. Absent = pieces (ADR-011). */
  unit?: SaleUnit;
  /** "Harga bisa diubah saat jual": the seller may type the price at the cashier (ADR-011). */
  isPriceEditable?: boolean;
  /** "Harga modal": optional cost of one unit, copied onto each sold item (ADR-007). */
  costPrice?: Rupiah;
  photoUrl?: string;
  sku?: string;
  isActive: boolean;
  /** "Habis": shown but not sellable at the cashier until switched back (ADR-006). */
  isSoldOut?: boolean;
  sortOrder: number;
  /** Add-on groups (ADR-012: stored as "variant groups"; the interface calls them add-ons). */
  variantGroupIds: Id[];
  /** salesModeId -> price override (e.g. Takeaway cup cost). */
  modePrices: Record<Id, Rupiah>;
  /** Real variants (Kopi → Latte, Americano…), each with its own full price. Absent/empty = no variants (ADR-012). */
  variants?: ProductVariant[];
}

/** One variant of a product, sold as its own item: "Kopi – Latte" (ADR-012). */
export interface ProductVariant {
  id: Id;
  name: string;
  /** Full price for the default (Dine In) mode. */
  price: Rupiah;
  /** salesModeId -> price for "per product" modes such as Takeaway. */
  modePrices?: Record<Id, Rupiah>;
  costPrice?: Rupiah;
  isSoldOut?: boolean;
  sortOrder: number;
}

/** Option of an add-on group (ADR-012: the type keeps its historical name). */
export interface VariantOption {
  id: Id;
  name: string;
  priceDelta: Rupiah;
  sortOrder: number;
}

/** An add-on group: Es, Gula, Ukuran… (ADR-012: the type keeps its historical name). */
export interface VariantGroup extends SyncMeta {
  name: string;
  isRequired: boolean;
  selectType: 'single' | 'multi';
  min: number;
  max: number;
  options: VariantOption[];
}

export interface SalesMode extends SyncMeta {
  name: string;
  isDefault: boolean;
  isActive: boolean;
  priceRule: PriceRule;
  markupPct: number;
  sortOrder: number;
}

export interface PaymentMethod extends SyncMeta {
  name: string;
  type: PaymentType;
  referenceMode: ReferenceMode;
  referenceLabel: string;
  qrisImageUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Discount extends SyncMeta {
  name: string;
  scope: DiscountScope;
  type: DiscountType;
  value: number;
  isActive: boolean;
}

export interface Customer extends SyncMeta {
  name: string;
  phone?: string;
  note?: string;
}

/** Discount applied to a line or order — snapshot, not a reference. */
export interface AppliedDiscount {
  discountId: Id | null;
  name: string;
  type: DiscountType;
  value: number;
  /** Owner who approved a discount above the cashier limit (ADR-004). */
  approvedById?: Id | null;
}

export interface SelectedOption {
  groupId: Id;
  optionId: Id;
  name: string;
  priceDelta: Rupiah;
}

export interface OrderItem {
  id: Id;
  productId: Id;
  nameSnapshot: string;
  unitPrice: Rupiah;
  /** Cost of one unit when it was added to the cart; absent when the product had no cost price (ADR-007). */
  unitCost?: Rupiah;
  /** Normal unit price when sold, kept only for flexible-price products; differs from `unitPrice` when the seller changed it (ADR-011). */
  listPrice?: Rupiah;
  /** Set when a product variant was sold; `nameSnapshot` is then "Product – Variant" (ADR-012). */
  variantId?: Id;
  variantName?: string;
  /** Absent = pieces. For a measured unit, `qty` is a decimal weight/length/volume (ADR-011). */
  unit?: SaleUnit;
  qty: number;
  options: SelectedOption[];
  discount: AppliedDiscount | null;
  note: string;
}

export interface OrderPayment {
  id: Id;
  paymentMethodId: Id;
  methodNameSnapshot: string;
  methodType: PaymentType;
  amount: Rupiah;
  reference?: string;
  cashReceived?: Rupiah;
  change?: Rupiah;
}

export interface OrderTotals {
  subtotal: Rupiah;
  itemDiscountTotal: Rupiah;
  orderDiscountTotal: Rupiah;
  serviceTotal: Rupiah;
  taxTotal: Rupiah;
  grandTotal: Rupiah;
}

export interface Order extends SyncMeta {
  receiptNo: string;
  status: OrderStatus;
  salesModeId: Id;
  salesModeNameSnapshot: string;
  customerId: Id | null;
  /** Customer's name when the order was saved (ADR-005); null when no customer. */
  customerNameSnapshot?: string | null;
  /** Open-order label: table number or free text ("Mas jaket merah"). */
  label: string;
  items: OrderItem[];
  orderDiscount: AppliedDiscount | null;
  payments: OrderPayment[];
  totals: OrderTotals;
  cashierId: Id;
  businessDate: BusinessDate;
  openedAt: IsoDateTime;
  paidAt: IsoDateTime | null;
}

export interface RefundItem {
  orderItemId: Id;
  qty: number;
  amount: Rupiah;
}

export interface Refund extends SyncMeta {
  orderId: Id;
  /** Business day the refund happened (store tz + cut-off) — refunds count on this day (ADR-002). */
  businessDate: BusinessDate;
  kind: RefundKind;
  amount: Rupiah;
  items: RefundItem[];
  reasonCode: RefundReason;
  reasonNote: string;
  actorId: Id;
  approvedById: Id | null;
}

export interface AuditEvent extends SyncMeta {
  entity: string;
  entityId: Id;
  action: string;
  actorId: Id;
  payload: Record<string, unknown>;
}

export type ExpenseCategory = 'ingredients' | 'wages' | 'rent' | 'utilities' | 'transport' | 'supplies' | 'other';

/** Money that left the business (ADR-007). No edit: delete and record again. */
export interface Expense extends SyncMeta {
  businessDate: BusinessDate;
  category: ExpenseCategory;
  amount: Rupiah;
  note: string;
  /** Paid with cash from the drawer — reduces the expected cash at close of day. */
  isFromDrawer: boolean;
  actorId: Id;
}

export interface ClosingMethodTotal {
  name: string;
  type: PaymentType;
  amount: Rupiah;
}

/** "Tutup kasir": the drawer figures at closing time plus the counted cash. Immutable (ADR-007). */
export interface DayClosing extends SyncMeta {
  businessDate: BusinessDate;
  /** Shift of the day on this device, from 1 (ADR-027). Absent on closings made before shifts = 1. */
  shiftNo?: number;
  openingCash: Rupiah;
  cashSales: Rupiah;
  cashRefunds: Rupiah;
  drawerExpenses: Rupiah;
  expectedCash: Rupiah;
  countedCash: Rupiah;
  /** countedCash − expectedCash: negative = short, positive = over. */
  difference: Rupiah;
  netSales: Rupiah;
  transactions: number;
  expensesTotal: Rupiah;
  byMethod: ClosingMethodTotal[];
  openOrderCount: number;
  openOrderAmount: Rupiah;
  note: string;
  closedById: Id;
  closedAt: IsoDateTime;
}

/** Local outbox row waiting to be pushed to the server. */
export interface OutboxEntry {
  seq?: number;
  table: SyncTable;
  recordId: Id;
  op: 'upsert';
  queuedAt: IsoDateTime;
  attempts: number;
  lastError?: string;
}

export const SYNC_TABLES = [
  'categories',
  'products',
  'variantGroups',
  'salesModes',
  'paymentMethods',
  'discounts',
  'customers',
  'orders',
  'refunds',
  'auditEvents',
  'storeMembers',
  'expenses',
  'dayClosings',
  'stores',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

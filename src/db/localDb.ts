import Dexie, { type EntityTable } from 'dexie';
import { uuidv7 } from '../lib/id';
import type {
  AuditEvent,
  Category,
  Customer,
  DayClosing,
  Discount,
  Expense,
  Order,
  OutboxEntry,
  PaymentMethod,
  Product,
  ReceiptEmailRow,
  ReceiptShareRow,
  Refund,
  SalesMode,
  Store,
  StoreMember,
  VariantGroup,
} from '../types';

/**
 * Local IndexedDB — the POS reads and writes ONLY here.
 * The sync service mirrors changes to the Pikul server in the background (offline-first, ADR-025).
 */
export class LocalDb extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  products!: EntityTable<Product, 'id'>;
  variantGroups!: EntityTable<VariantGroup, 'id'>;
  salesModes!: EntityTable<SalesMode, 'id'>;
  paymentMethods!: EntityTable<PaymentMethod, 'id'>;
  discounts!: EntityTable<Discount, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  orders!: EntityTable<Order, 'id'>;
  refunds!: EntityTable<Refund, 'id'>;
  auditEvents!: EntityTable<AuditEvent, 'id'>;
  storeMembers!: EntityTable<StoreMember, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  meta!: EntityTable<{ key: string; value: string }, 'key'>;
  stores!: EntityTable<Store, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  dayClosings!: EntityTable<DayClosing, 'id'>;
  receiptShares!: EntityTable<ReceiptShareRow, 'orderId'>;
  receiptEmails!: EntityTable<ReceiptEmailRow, 'seq'>;

  constructor() {
    // Legacy database name, frozen (ADR-016): renaming it would orphan every sale on the device.
    super('kasirku');
    this.version(1).stores({
      categories: 'id, storeId, sortOrder',
      products: 'id, storeId, categoryId, isActive, name',
      variantGroups: 'id, storeId',
      salesModes: 'id, storeId, sortOrder',
      paymentMethods: 'id, storeId, sortOrder',
      discounts: 'id, storeId, isActive',
      customers: 'id, storeId, name, phone',
      orders: 'id, storeId, status, businessDate, receiptNo, customerId, [storeId+businessDate], [storeId+status]',
      refunds: 'id, storeId, orderId',
      auditEvents: 'id, storeId, entityId, createdAt',
      storeMembers: 'id, storeId, role',
      outbox: '++seq, table, recordId',
      meta: 'key',
    });
    this.version(2).stores({
      stores: 'id',
    });
    // ADR-002: refunds are queried by the day they happened.
    this.version(3)
      .stores({ refunds: 'id, storeId, orderId, [storeId+businessDate]' })
      .upgrade((tx) =>
        tx
          .table('refunds')
          .toCollection()
          .modify((refund: { businessDate?: string; createdAt: string }) => {
            refund.businessDate ??= refund.createdAt.slice(0, 10);
          }),
      );
    // ADR-007: expenses and day closings, both read by business day.
    this.version(4).stores({
      expenses: 'id, storeId, [storeId+businessDate]',
      dayClosings: 'id, storeId, [storeId+businessDate]',
    });
    // ADR-026: cash records made before sync all belong to this device's drawer. Same key as services/device.ts.
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        const meta = tx.table('meta');
        let deviceId = ((await meta.get('deviceId')) as { value: string } | undefined)?.value;
        if (!deviceId) {
          deviceId = uuidv7();
          await meta.put({ key: 'deviceId', value: deviceId });
        }
        for (const name of ['orders', 'refunds', 'expenses', 'dayClosings']) {
          await tx
            .table(name)
            .toCollection()
            .modify((r: { deviceId?: string }) => {
              r.deviceId ??= deviceId;
            });
        }
      });
    // ADR-028: receipts the cashier shared (link token, last uploaded copy) and receipt emails waiting to be sent.
    this.version(6).stores({
      receiptShares: 'orderId, &token',
      receiptEmails: '++seq, orderId',
    });
  }
}

export const localDb = new LocalDb();

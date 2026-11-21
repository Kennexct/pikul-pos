import { ORDER_STATUS_LABEL } from '../constants';
import { assertCanSell } from '../store/useAccessStore';
import { localDb } from '../db/localDb';
import { formatReceiptNo, getBusinessDate } from '../lib/businessDate';
import { nowIso, uuidv7 } from '../lib/id';
import { calculateTotals } from '../lib/pricing';
import type { AppliedDiscount, Id, Order, OrderItem, OrderPayment, PaymentMethod, SalesMode, Store } from '../types';
import { getDeviceId, getReceiptCode } from './device';
import { saveAndQueue } from './sync';
import { t } from '../i18n';
import { MAX_QUANTITY } from '../lib/quantity';


export interface CartSnapshot {
  openOrderId: Id | null;
  items: OrderItem[];
  orderDiscount: AppliedDiscount | null;
  customerId: Id | null;
  label: string;
}

interface OrderContext {
  store: Store;
  salesMode: SalesMode;
  cashierId: Id;
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  cashReceived?: number;
}

async function nextReceiptNo(businessDate: string): Promise<string> {
  const deviceCode = await getReceiptCode();
  const key = `seq:${businessDate}`;
  return localDb.transaction('rw', localDb.meta, async () => {
    const current = Number((await localDb.meta.get(key))?.value ?? '0');
    const next = current + 1;
    await localDb.meta.put({ key, value: String(next) });
    return formatReceiptNo(businessDate, deviceCode, next);
  });
}

async function buildOrder(cart: CartSnapshot, ctx: OrderContext): Promise<Order> {
  if (cart.items.length === 0) throw new Error(t('Keranjang masih kosong.'));
  // Weights and typed prices come from the entry sheet; never store a line that is not a positive quantity at a valid price.
  const isBadLine = (item: OrderItem) => !Number.isFinite(item.qty) || item.qty <= 0 || item.qty > MAX_QUANTITY || !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0;
  if (cart.items.some(isBadLine)) throw new Error(t('Jumlah atau harga item tidak valid.'));

  const now = nowIso();
  const existing = cart.openOrderId ? await localDb.orders.get(cart.openOrderId) : undefined;
  if (existing && existing.status !== 'open') {
    throw new Error(t('Pesanan {0} berstatus {1}, tidak bisa diubah.', existing.receiptNo, ORDER_STATUS_LABEL[existing.status]));
  }
  const businessDate = existing?.businessDate ?? getBusinessDate(new Date(), ctx.store);
  // A customer deleted while the cart was open is dropped instead of leaving a dangling id.
  const found = cart.customerId ? await localDb.customers.get(cart.customerId) : undefined;
  const customer = found && !found.deletedAt ? found : undefined;

  return {
    id: existing?.id ?? uuidv7(),
    storeId: ctx.store.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    receiptNo: existing?.receiptNo ?? (await nextReceiptNo(businessDate)),
    deviceId: await getDeviceId(),
    status: 'open',
    salesModeId: ctx.salesMode.id,
    salesModeNameSnapshot: ctx.salesMode.name,
    customerId: customer?.id ?? null,
    customerNameSnapshot: customer?.name ?? null,
    label: cart.label,
    items: cart.items,
    orderDiscount: cart.orderDiscount,
    payments: [],
    totals: calculateTotals(cart.items, cart.orderDiscount, ctx.store),
    cashierId: ctx.cashierId,
    businessDate,
    openedAt: existing?.openedAt ?? now,
    paidAt: null,
  };
}

/** M8: save an unpaid order ("bayar nanti"). A label is required so it can be found later. */
export async function saveOpenOrder(cart: CartSnapshot, ctx: OrderContext): Promise<Order> {
  assertCanSell();
  if (cart.label.trim().length === 0) throw new Error(t('Isi label pesanan (contoh: Meja 5).'));
  const order = await buildOrder(cart, ctx);
  await saveAndQueue('orders', order);
  return order;
}

export function validatePayment(payment: PaymentInput, grandTotal: number): string | null {
  const { method, reference, cashReceived } = payment;
  if (method.referenceMode === 'required' && !reference?.trim()) {
    return t('{0} wajib diisi untuk {1}.', method.referenceLabel || t('Referensi'), method.name);
  }
  if (method.type === 'cash' && (cashReceived ?? 0) < grandTotal) {
    return t('Uang diterima kurang dari total.');
  }
  return null;
}

/** M1/M5: complete a sale with a single payment method (split payment is planned for v1.1). */
export async function completeOrder(cart: CartSnapshot, ctx: OrderContext, payment: PaymentInput): Promise<Order> {
  assertCanSell();
  const draft = await buildOrder(cart, ctx);
  const error = validatePayment(payment, draft.totals.grandTotal);
  if (error) throw new Error(error);

  const isCash = payment.method.type === 'cash';
  const orderPayment: OrderPayment = {
    id: uuidv7(),
    paymentMethodId: payment.method.id,
    methodNameSnapshot: payment.method.name,
    methodType: payment.method.type,
    amount: draft.totals.grandTotal,
    reference: payment.reference?.trim() || undefined,
    cashReceived: isCash ? payment.cashReceived : undefined,
    change: isCash ? (payment.cashReceived ?? 0) - draft.totals.grandTotal : undefined,
  };

  // Cash basis (ADR-002, ADR-007): a saved order paid on a later day counts on the day the money came in.
  // The receipt number keeps the day the order was opened.
  const order: Order = {
    ...draft,
    status: 'paid',
    payments: [orderPayment],
    paidAt: nowIso(),
    businessDate: getBusinessDate(new Date(), ctx.store),
  };
  await saveAndQueue('orders', order);
  return order;
}

/** M8: cancel an unpaid order with a reason. Kept as a record (never deleted) and audited. */
export async function cancelOpenOrder(orderId: Id, reason: string, actorId: Id): Promise<void> {
  if (reason.trim().length === 0) throw new Error(t('Alasan pembatalan wajib diisi.'));
  const order = await localDb.orders.get(orderId);
  if (!order) throw new Error(t('Pesanan tidak ditemukan.'));
  if (order.status !== 'open') throw new Error(t('Hanya pesanan terbuka yang bisa dibatalkan.'));

  const now = nowIso();
  await saveAndQueue('orders', { ...order, status: 'cancelled', updatedAt: now });
  await saveAndQueue('auditEvents', {
    id: uuidv7(),
    storeId: order.storeId,
    createdAt: now,
    updatedAt: now,
    entity: 'order',
    entityId: order.id,
    action: 'cancel_open_order',
    actorId,
    payload: { receiptNo: order.receiptNo, reason: reason.trim(), grandTotal: order.totals.grandTotal },
  });
}

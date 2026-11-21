import { REFUND_REASON_LABEL } from '../constants';
import { localDb } from '../db/localDb';
import { getBusinessDate } from '../lib/businessDate';
import { daysBetween } from '../lib/dateRange';
import { nowIso, uuidv7 } from '../lib/id';
import { APPROVAL_EXPIRED, approverOf, OWNER_PIN_REQUIRED, requiresOwnerPin, type OwnerAccess } from '../lib/permissions';
import { buildRefundItems, isFullyRefunded, type RefundSelection } from '../lib/refunds';
import type { Id, Order, PermissionLevel, Refund, RefundKind, RefundReason, Store } from '../types';
import { getDeviceId } from './device';
import { saveAndQueue } from './sync';
import { t } from '../i18n';

export interface ReasonInput {
  code: RefundReason;
  note: string;
}

export interface RefundContext {
  store: Store;
  actorId: Id;
  /** Owner powers at the moment of the action (ADR-004). */
  access: OwnerAccess;
  now?: Date;
}

/** `needsOwnerPin`: every business rule passes and only the owner PIN is missing — the UI may prompt for it. */
export type Eligibility = { ok: true } | { ok: false; reason: string; needsOwnerPin?: true };

/** Checked last, so we never ask for a PIN for an action that is impossible anyway. */
function permissionGate(level: PermissionLevel, ctx: RefundContext): Eligibility {
  const now = (ctx.now ?? new Date()).getTime();
  if (!requiresOwnerPin(level, ctx.access, now)) return { ok: true };
  const reason = ctx.access.kind === 'approved' ? APPROVAL_EXPIRED : OWNER_PIN_REQUIRED;
  return { ok: false, reason, needsOwnerPin: true };
}

const REFUNDABLE_STATUSES: ReadonlySet<Order['status']> = new Set(['paid', 'partial_refund']);

/** M11: void = cancel a whole paid sale on the same business day, before any refund. */
export function canVoid(order: Order, refunds: readonly Refund[], ctx: RefundContext): Eligibility {
  if (order.status !== 'paid') return { ok: false, reason: t('Hanya transaksi lunas yang bisa di-void.') };
  if (refunds.length > 0) return { ok: false, reason: t('Transaksi sudah direfund sebagian. Gunakan refund.') };
  const today = getBusinessDate(ctx.now ?? new Date(), ctx.store);
  if (order.businessDate !== today) return { ok: false, reason: t('Void hanya untuk transaksi hari ini. Gunakan refund.') };
  return permissionGate(ctx.store.settings.voidPermission, ctx);
}

/** M11: refund = return some or all items within the store's refund window. */
export function canRefund(order: Order, ctx: RefundContext): Eligibility {
  if (!REFUNDABLE_STATUSES.has(order.status)) return { ok: false, reason: t('Transaksi ini tidak bisa direfund.') };
  const today = getBusinessDate(ctx.now ?? new Date(), ctx.store);
  const age = daysBetween(order.businessDate, today);
  if (age > ctx.store.settings.refundWindowDays) {
    return { ok: false, reason: t('Batas refund {0} hari sudah lewat.', ctx.store.settings.refundWindowDays) };
  }
  return permissionGate(ctx.store.settings.refundPermission, ctx);
}

function validateReason(reason: ReasonInput, store: Store): void {
  if (store.settings.isReasonRequired && reason.code === 'other' && reason.note.trim().length === 0) {
    throw new Error(t('Tuliskan alasannya.'));
  }
}

async function loadOrder(orderId: Id): Promise<{ order: Order; refunds: Refund[] }> {
  const order = await localDb.orders.get(orderId);
  if (!order) throw new Error(t('Transaksi tidak ditemukan.'));
  const refunds = await localDb.refunds.where('orderId').equals(orderId).toArray();
  return { order, refunds };
}

/**
 * Writes the refund record, the new order status and an audit event in ONE IndexedDB
 * transaction, so a crash can never leave money returned without a matching status.
 */
async function commit(order: Order, kind: RefundKind, built: ReturnType<typeof buildRefundItems>, reason: ReasonInput, ctx: RefundContext, nextStatus: Order['status']): Promise<Refund> {
  const now = nowIso();
  const refund: Refund = {
    id: uuidv7(),
    storeId: order.storeId,
    createdAt: now,
    updatedAt: now,
    deviceId: await getDeviceId(),
    orderId: order.id,
    businessDate: getBusinessDate(ctx.now ?? new Date(), ctx.store),
    kind,
    amount: built.amount,
    items: built.items,
    reasonCode: reason.code,
    reasonNote: reason.note.trim(),
    actorId: ctx.actorId,
    approvedById: approverOf(ctx.access),
  };

  await localDb.transaction('rw', [localDb.orders, localDb.refunds, localDb.auditEvents, localDb.outbox], async () => {
    await saveAndQueue('refunds', refund);
    await saveAndQueue('orders', { ...order, status: nextStatus, updatedAt: now });
    await saveAndQueue('auditEvents', {
      id: uuidv7(),
      storeId: order.storeId,
      createdAt: now,
      updatedAt: now,
      entity: 'order',
      entityId: order.id,
      action: kind,
      actorId: ctx.actorId,
      payload: {
        receiptNo: order.receiptNo,
        amount: refund.amount,
        reason: REFUND_REASON_LABEL[reason.code],
        note: refund.reasonNote,
        approvedById: refund.approvedById,
        items: refund.items,
      },
    });
  });
  return refund;
}

export async function voidOrder(orderId: Id, reason: ReasonInput, ctx: RefundContext): Promise<Refund> {
  validateReason(reason, ctx.store);
  const { order, refunds } = await loadOrder(orderId);
  const eligibility = canVoid(order, refunds, ctx);
  if (!eligibility.ok) throw new Error(eligibility.reason);

  const all = order.items.map((item) => ({ orderItemId: item.id, qty: item.qty }));
  return commit(order, 'void', buildRefundItems(order, all, []), reason, ctx, 'void');
}

export async function refundOrder(orderId: Id, selections: readonly RefundSelection[], reason: ReasonInput, ctx: RefundContext): Promise<Refund> {
  validateReason(reason, ctx.store);
  const { order, refunds } = await loadOrder(orderId);
  const eligibility = canRefund(order, ctx);
  if (!eligibility.ok) throw new Error(eligibility.reason);

  const built = buildRefundItems(order, selections, refunds);
  if (built.amount <= 0) throw new Error(t('Tidak ada nominal yang bisa direfund.'));
  const nextStatus = isFullyRefunded(order, [...refunds, { items: built.items }]) ? 'refunded' : 'partial_refund';
  return commit(order, 'refund', built, reason, ctx, nextStatus);
}

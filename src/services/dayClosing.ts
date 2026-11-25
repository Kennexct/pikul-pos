import { APP_EVENTS, emitAppEvent } from '../lib/appEvents';
import { CLOSING_NOTE_MAX } from '../constants';
import { localDb } from '../db/localDb';
import { buildDrawer, type DrawerInput } from '../lib/cashDrawer';
import { nowIso } from '../lib/id';
import { isCountedSale } from '../lib/reports';
import { currentShiftNo, isInWindow, saleTime, shiftNoOf, shiftWindow, sortShifts } from '../lib/shifts';
import type { BusinessDate, DayClosing, Id, Product } from '../types';
import { writeAudit } from './audit';
import { newMeta } from './catalog';
import { getDeviceId, isThisDevice } from './device';
import { saveAndQueue } from './sync';
import { t } from '../i18n';

/** Shift 1 keeps the key used before shifts (ADR-027), so an opening typed before the update still counts. */
const openingKey = (storeId: Id, date: BusinessDate, shiftNo = 1) => `openingCash:${storeId}:${date}${shiftNo > 1 ? `:${shiftNo}` : ''}`;

/** This device's live closings of the day, in shift order (ADR-026: each device closes its own drawer; ADR-027: one per shift). */
export async function getClosings(storeId: Id, date: BusinessDate): Promise<DayClosing[]> {
  const here = await getDeviceId();
  const rows = await localDb.dayClosings
    .where('[storeId+businessDate]')
    .equals([storeId, date])
    .filter((c) => !c.deletedAt && isThisDevice(c, here))
    .toArray();
  return sortShifts(rows);
}

/** This device's closing of one shift; without a shift, the day's latest closing. */
export async function getClosing(storeId: Id, date: BusinessDate, shiftNo?: number): Promise<DayClosing | undefined> {
  const closings = await getClosings(storeId, date);
  return shiftNo === undefined ? closings.at(-1) : closings.find((c) => shiftNoOf(c) === shiftNo);
}

/** The shift running now (or the next one to open): one after the day's last closing. */
export async function getCurrentShiftNo(storeId: Id, date: BusinessDate): Promise<number> {
  return currentShiftNo(await getClosings(storeId, date));
}

/**
 * What was typed for the shift. Otherwise a later shift starts with what the previous shift counted,
 * and the first shift with the previous day's opening cash (sellers usually start with the same float).
 */
export async function getOpeningCash(storeId: Id, date: BusinessDate, shiftNo?: number): Promise<number> {
  const shift = shiftNo ?? (await getCurrentShiftNo(storeId, date));
  const typed = await localDb.meta.get(openingKey(storeId, date, shift));
  if (typed) return Number(typed.value) || 0;
  if (shift > 1) {
    const previous = (await getClosings(storeId, date)).filter((c) => shiftNoOf(c) < shift).at(-1);
    if (previous) return previous.countedCash;
  }
  const here = await getDeviceId();
  const earlier = await localDb.dayClosings
    .where('[storeId+businessDate]')
    .between([storeId, ''], [storeId, date], true, false)
    .filter((c) => !c.deletedAt && isThisDevice(c, here))
    .toArray();
  const firstOfLastDay = earlier.sort((a, b) => a.businessDate.localeCompare(b.businessDate) || shiftNoOf(b) - shiftNoOf(a)).at(-1);
  return firstOfLastDay?.openingCash ?? 0;
}

/** True once an opening cash was typed for the shift (default: the current one) — the register was opened (ADR-017). */
export async function hasOpening(storeId: Id, date: BusinessDate, shiftNo?: number): Promise<boolean> {
  const shift = shiftNo ?? (await getCurrentShiftNo(storeId, date));
  return (await localDb.meta.get(openingKey(storeId, date, shift))) !== undefined;
}

/**
 * Records the opening cash of the current shift. The first time it opens the register (after a closing: a new shift,
 * ADR-027); later it is a change. Both are audited (ADR-017).
 */
export async function setOpeningCash(storeId: Id, date: BusinessDate, amount: number, actorId: Id): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(t('Modal awal tidak valid.'));
  const shiftNo = await getCurrentShiftNo(storeId, date);
  const key = openingKey(storeId, date, shiftNo);
  const previous = await localDb.meta.get(key);
  await localDb.meta.put({ key, value: String(amount) });
  await writeAudit({
    storeId,
    actorId,
    entity: 'register',
    entityId: key,
    action: previous ? 'opening_cash_changed' : 'register_opened',
    payload: previous ? { businessDate: date, shiftNo, from: Number(previous.value) || 0, to: amount } : { businessDate: date, shiftNo, openingCash: amount },
  });
  if (!previous && shiftNo === 1) emitAppEvent(APP_EVENTS.registerOpened, { businessDate: date }); // register pop-up once a day (ADR-020)
}

/**
 * Everything this device's drawer maths needs for one shift of a business day (ADR-026, ADR-027); default the current shift.
 * Also used inside live queries.
 */
export async function loadDrawerInput(storeId: Id, date: BusinessDate, shiftNo?: number): Promise<DrawerInput> {
  const key = [storeId, date];
  const here = await getDeviceId();
  const closings = await getClosings(storeId, date);
  const shift = shiftNo ?? currentShiftNo(closings);
  const window = shiftWindow(closings, shift);
  const sales = await localDb.orders
    .where('[storeId+businessDate]')
    .equals(key)
    .filter((o) => o.status !== 'open' && !o.deletedAt && isThisDevice(o, here) && isInWindow(saleTime(o), window))
    .toArray();
  const refunds = await localDb.refunds
    .where('[storeId+businessDate]')
    .equals(key)
    .filter((r) => isThisDevice(r, here) && isInWindow(r.createdAt, window))
    .toArray();
  const ordersById = new Map(sales.map((o) => [o.id, o]));
  const missing = [...new Set(refunds.map((r) => r.orderId))].filter((id) => !ordersById.has(id));
  for (const order of missing.length > 0 ? await localDb.orders.bulkGet(missing) : []) if (order) ordersById.set(order.id, order);

  const expenses = await localDb.expenses
    .where('[storeId+businessDate]')
    .equals(key)
    .filter((e) => !e.deletedAt && isThisDevice(e, here) && isInWindow(e.createdAt, window))
    .toArray();
  const openOrders = await localDb.orders.where('[storeId+status]').equals([storeId, 'open']).filter((o) => !o.deletedAt).toArray();
  return { openingCash: await getOpeningCash(storeId, date, shift), sales, refunds, ordersById, expenses, openOrders };
}

/** Switch every "Habis" item back to available (ADR-006). Returns how many were reset. */
export async function resetSoldOut(storeId: Id): Promise<number> {
  const anyVariantSoldOut = (p: Product) => (p.variants ?? []).some((v) => v.isSoldOut === true);
  const soldOut = await localDb.products.where('storeId').equals(storeId).filter((p) => (p.isSoldOut === true || anyVariantSoldOut(p)) && !p.deletedAt).toArray();
  const now = nowIso();
  for (const product of soldOut) {
    const variants = product.variants?.map((v) => ({ ...v, isSoldOut: false }));
    await saveAndQueue('products', { ...product, isSoldOut: false, ...(variants ? { variants } : {}), updatedAt: now });
  }
  return soldOut.length;
}

export interface CloseDayInput {
  storeId: Id;
  businessDate: BusinessDate;
  /** Null while the field is empty. */
  countedCash: number | null;
  note: string;
  actorId: Id;
  shouldResetSoldOut: boolean;
}

/** "Tutup kasir" (ADR-007): stores the current shift's drawer figures as they are now, plus the counted cash. One per shift (ADR-027). */
export async function closeDay(input: CloseDayInput): Promise<DayClosing> {
  const { storeId, businessDate, countedCash } = input;
  if (countedCash === null || !Number.isSafeInteger(countedCash) || countedCash < 0) throw new Error(t('Isi jumlah uang yang dihitung di laci.'));
  const note = input.note.trim();
  if (note.length > CLOSING_NOTE_MAX) throw new Error(t('Catatan maksimal {0} karakter.', CLOSING_NOTE_MAX));

  const shiftNo = await getCurrentShiftNo(storeId, businessDate);
  const shiftInput = await loadDrawerInput(storeId, businessDate, shiftNo);
  const isStarted = shiftNo === 1 || (await hasOpening(storeId, businessDate, shiftNo)) || shiftInput.sales.some(isCountedSale);
  if (!isStarted) throw new Error(t('Kasir sudah ditutup. Buka shift baru dulu.'));
  const drawer = buildDrawer(shiftInput);
  const now = nowIso();
  const closing: DayClosing = {
    ...newMeta(storeId),
    deviceId: await getDeviceId(),
    ...drawer,
    businessDate,
    shiftNo,
    countedCash,
    difference: countedCash - drawer.expectedCash,
    note,
    closedById: input.actorId,
    closedAt: now,
  };

  // Check + write in one transaction so a double tap or a second tab cannot close the same shift twice.
  await localDb.transaction('rw', localDb.dayClosings, localDb.outbox, async () => {
    if (await getClosing(storeId, businessDate, shiftNo)) throw new Error(t('Shift ini sudah ditutup.'));
    await saveAndQueue('dayClosings', closing);
  });

  await writeAudit({
    storeId,
    actorId: input.actorId,
    entity: 'day_closing',
    entityId: closing.id,
    action: 'day_closed',
    payload: { businessDate, shiftNo, expectedCash: closing.expectedCash, countedCash, difference: closing.difference },
  });
  if (input.shouldResetSoldOut) await resetSoldOut(storeId);
  emitAppEvent(APP_EVENTS.dayClosed, { businessDate }); // send daily totals now (ADR-020)
  return closing;
}

/** True when the shift after this closing was opened or already has a sale: the closing then stays locked (ADR-027). */
export async function hasNextShiftStarted(closing: DayClosing): Promise<boolean> {
  const { storeId, businessDate } = closing;
  const closings = await getClosings(storeId, businessDate);
  const next = shiftNoOf(closing) + 1;
  if (closings.some((c) => shiftNoOf(c) >= next)) return true;
  if (await hasOpening(storeId, businessDate, next)) return true;
  const input = await loadDrawerInput(storeId, businessDate, next);
  return input.sales.some(isCountedSale);
}

/**
 * Owner only (caller checks, ADR-004): removes the latest closing so that shift can be counted again. Audited.
 * Only while the next shift has not started: closed shifts are never continued (ADR-027).
 */
export async function reopenDay(closingId: Id, actorId: Id, approvedById: Id | null): Promise<void> {
  const closing = await localDb.dayClosings.get(closingId);
  if (!closing || closing.deletedAt) throw new Error(t('Tutup kasir tidak ditemukan.'));
  if (await hasNextShiftStarted(closing)) throw new Error(t('Shift berikutnya sudah dimulai, jadi shift ini tidak bisa dibuka kembali.'));
  const now = nowIso();
  await saveAndQueue('dayClosings', { ...closing, deletedAt: now, updatedAt: now });
  await writeAudit({
    storeId: closing.storeId,
    actorId,
    entity: 'day_closing',
    entityId: closing.id,
    action: 'day_reopened',
    payload: { businessDate: closing.businessDate, shiftNo: shiftNoOf(closing), difference: closing.difference, approvedById },
  });
}

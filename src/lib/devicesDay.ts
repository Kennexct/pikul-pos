import type { DayClosing, Id, Order, Refund } from '../types';
import { isCountedSale } from './reports';
import { saleTime } from './shifts';

/** Kas → "Semua perangkat" (ADR-026): each device's sales and closing for one business day, plus the store total. Pure. */

export interface DeviceDayRow {
  deviceId: Id;
  name: string;
  /** Sales minus refunds on the day. */
  net: number;
  /** Cash taken minus cash refunds on the day (before opening cash and drawer expenses). */
  cash: number;
  transactions: number;
  /** The device's closings of the day added up (ADR-027: one per shift), or null before its first closing. */
  closing: { countedCash: number; difference: number; shifts: number; lastClosedAt: string } | null;
  /** A shift is running after the last closing: there are sales or refunds after it. */
  isRunning: boolean;
}

export interface DevicesDay {
  rows: DeviceDayRow[];
  total: { net: number; cash: number; transactions: number };
}

interface Input {
  sales: Order[];
  refunds: Refund[];
  closings: DayClosing[];
  ordersById: ReadonlyMap<Id, Order>;
  names: ReadonlyMap<Id, string>;
  /** Records without a device id belong to this device (made before v0.19). */
  here: Id;
}

export function devicesDay({ sales, refunds, closings, ordersById, names, here }: Input): DevicesDay {
  const rows = new Map<Id, DeviceDayRow>();
  const row = (deviceId: Id | undefined) => {
    const id = deviceId ?? here;
    let r = rows.get(id);
    if (!r) {
      r = { deviceId: id, name: names.get(id) ?? '', net: 0, cash: 0, transactions: 0, closing: null, isRunning: false };
      rows.set(id, r);
    }
    return r;
  };
  for (const order of sales) {
    if (!isCountedSale(order) || order.deletedAt) continue;
    const r = row(order.deviceId);
    r.net += order.totals.grandTotal;
    r.cash += order.payments.filter((p) => p.methodType === 'cash').reduce((sum, p) => sum + p.amount, 0);
    r.transactions += 1;
  }
  for (const refund of refunds) {
    if (refund.deletedAt || refund.kind !== 'refund') continue; // same rule as the drawer (lib/cashDrawer.ts)
    const r = row(refund.deviceId);
    r.net -= refund.amount;
    if (ordersById.get(refund.orderId)?.payments[0]?.methodType === 'cash') r.cash -= refund.amount;
  }
  for (const c of closings) {
    if (c.deletedAt) continue;
    const r = row(c.deviceId);
    const prev = r.closing ?? { countedCash: 0, difference: 0, shifts: 0, lastClosedAt: '' };
    r.closing = {
      countedCash: prev.countedCash + c.countedCash,
      difference: prev.difference + c.difference,
      shifts: prev.shifts + 1,
      lastClosedAt: c.closedAt > prev.lastClosedAt ? c.closedAt : prev.lastClosedAt,
    };
  }
  const after = (deviceId: Id | undefined, at: string | undefined) => {
    const r = rows.get(deviceId ?? here);
    if (r?.closing && at && at > r.closing.lastClosedAt) r.isRunning = true;
  };
  for (const order of sales) if (isCountedSale(order) && !order.deletedAt) after(order.deviceId, saleTime(order));
  for (const refund of refunds) if (!refund.deletedAt) after(refund.deviceId, refund.createdAt);
  if (rows.size > 0) row(here); // this device always has a row once any device has one
  const list = [...rows.values()].sort((a, b) => (a.deviceId === here ? -1 : b.deviceId === here ? 1 : a.name.localeCompare(b.name)));
  const total = list.reduce((s, r) => ({ net: s.net + r.net, cash: s.cash + r.cash, transactions: s.transactions + r.transactions }), { net: 0, cash: 0, transactions: 0 });
  return { rows: list, total };
}

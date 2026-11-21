import type { DayClosing, Id, Order, Refund } from '../types';
import { isCountedSale } from './reports';

/** Kas → "Semua perangkat" (ADR-025): each device's sales and closing for one business day, plus the store total. Pure. */

export interface DeviceDayRow {
  deviceId: Id;
  name: string;
  /** Sales minus refunds on the day. */
  net: number;
  /** Cash taken minus cash refunds on the day (before opening cash and drawer expenses). */
  cash: number;
  transactions: number;
  closing: { countedCash: number; difference: number } | null;
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
      r = { deviceId: id, name: names.get(id) ?? '', net: 0, cash: 0, transactions: 0, closing: null };
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
    row(c.deviceId).closing = { countedCash: c.countedCash, difference: c.difference };
  }
  if (rows.size > 0) row(here); // this device always has a row once any device has one
  const list = [...rows.values()].sort((a, b) => (a.deviceId === here ? -1 : b.deviceId === here ? 1 : a.name.localeCompare(b.name)));
  const total = list.reduce((s, r) => ({ net: s.net + r.net, cash: s.cash + r.cash, transactions: s.transactions + r.transactions }), { net: 0, cash: 0, transactions: 0 });
  return { rows: list, total };
}

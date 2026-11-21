import { describe, expect, it } from 'vitest';
import type { DayClosing, Order, Refund } from '../types';
import { devicesDay } from './devicesDay';

const order = (id: string, deviceId: string | undefined, amount: number, methodType: 'cash' | 'qris' = 'cash'): Order =>
  ({ id, deviceId, status: 'paid', totals: { grandTotal: amount }, payments: [{ amount, methodType }] }) as unknown as Order;

describe('devicesDay (ADR-025)', () => {
  it('splits sales, cash refunds and closings per device, legacy records count as this device', () => {
    const sales = [order('o1', 'A', 10_000), order('o2', undefined, 5_000), order('o3', 'B', 20_000, 'qris'), order('o4', 'B', 8_000)];
    const refunds = [{ id: 'r1', orderId: 'o4', deviceId: 'B', amount: 8_000, kind: 'refund' } as Refund];
    const closings = [{ id: 'c1', deviceId: 'A', countedCash: 14_000, difference: -1_000 } as DayClosing];
    const day = devicesDay({ sales, refunds, closings, ordersById: new Map(sales.map((o) => [o.id, o])), names: new Map([['B', 'HP Kasir']]), here: 'A' });
    expect(day.rows.map((r) => [r.deviceId, r.name, r.net, r.cash, r.transactions, r.closing?.difference ?? null])).toEqual([
      ['A', '', 15_000, 15_000, 2, -1_000],
      ['B', 'HP Kasir', 20_000, 0, 2, null],
    ]);
    expect(day.total).toEqual({ net: 35_000, cash: 15_000, transactions: 4 });
  });
});

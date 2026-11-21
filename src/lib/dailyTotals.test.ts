import { describe, expect, it } from 'vitest';
import { checkDaily } from '../../server/daily';
import type { Order, OrderItem, Refund } from '../types';
import { dailyRows, MAX_MODES, toDailyRow } from './dailyTotals';
import { buildReport } from './reports';

const item = (productId: string, unitPrice: number, qty: number): OrderItem => ({ id: `${productId}-line`, productId, nameSnapshot: productId, unitPrice, qty, options: [], discount: null, note: '' });

function order(id: string, date: string, paidAt: string, method: 'cash' | 'qris', items: OrderItem[]): Order {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  return {
    id, storeId: 's', createdAt: '', updatedAt: '', receiptNo: id, status: 'paid', salesModeId: 'dine', salesModeNameSnapshot: 'Dine In',
    customerId: null, label: 'Meja 3 Pak Budi', items, orderDiscount: null,
    payments: [{ id: 'p', paymentMethodId: method === 'qris' ? 'm-qris' : 'm-cash', methodNameSnapshot: method === 'qris' ? 'QRIS BCA' : 'Tunai', methodType: method, amount: subtotal }],
    totals: { subtotal, itemDiscountTotal: 0, orderDiscountTotal: 0, serviceTotal: 0, taxTotal: 0, grandTotal: subtotal },
    cashierId: 'owner', businessDate: date, openedAt: paidAt, paidAt,
  };
}
const refund = (orderId: string, date: string, amount: number): Refund => ({ id: `r-${orderId}`, storeId: 's', createdAt: '', updatedAt: '', orderId, businessDate: date, kind: 'refund', amount, items: [], reasonCode: 'customer_cancel', reasonNote: 'pelanggan batal', actorId: 'owner', approvedById: null });

const d1 = order('A', '2026-11-17', '2026-11-17T05:00:00Z', 'cash', [item('bakso', 15_000, 2)]);
const d2 = order('B', '2026-11-18', '2026-11-18T12:10:00Z', 'qris', [item('esteh', 6_000, 3)]);
const input = { store: { timezone: 'Asia/Jakarta' as const }, sales: [d1, d2], refunds: [refund('A', '2026-11-18', 30_000)], ordersById: new Map([d1, d2].map((o) => [o.id, o])), memberName: new Map([['owner', 'Pemilik']]) };

describe('daily totals sent to Pikul (ADR-020)', () => {
  it('builds one row per date with the same numbers as Laporan, refunds on their own day', () => {
    const [a, b] = dailyRows(input, ['2026-11-17', '2026-11-18'], 1);
    expect(a).toMatchObject({ businessDate: '2026-11-17', transactions: 1, gross: 30_000, refunds: 0, net: 30_000 });
    expect(a?.pay.cash).toEqual({ transactions: 1, gross: 30_000, refunds: 0 });
    expect(b).toMatchObject({ businessDate: '2026-11-18', transactions: 1, gross: 18_000, refunds: 30_000, net: -12_000 });
    expect(b?.pay.qris.gross).toBe(18_000);
    expect(b?.pay.cash.refunds).toBe(30_000);
    expect(b?.hours).toHaveLength(24);
    expect(b?.hours[19]).toEqual({ transactions: 1, gross: 18_000 });
  });

  it('carries totals only: no receipt lines, product names, customer labels, method names or notes', () => {
    const text = JSON.stringify(dailyRows(input, ['2026-11-17', '2026-11-18'], 1));
    for (const secret of ['bakso', 'esteh', 'Pak Budi', 'QRIS BCA', 'Tunai', 'pelanggan batal', 'Pemilik', 'm-qris']) expect(text).not.toContain(secret);
  });

  it('is accepted as-is by the server check, negative net included', () => {
    const rows = dailyRows(input, ['2026-11-17', '2026-11-18'], Date.parse('2026-11-18T13:00:00Z'));
    const r = checkDaily({ appVersion: '0.17.0', rows }, Date.parse('2026-11-18T13:00:00Z'));
    expect(r.ok).toBe(true);
  });

  it(`merges sales modes beyond ${MAX_MODES} into "Lainnya"`, () => {
    const report = buildReport({ ...input, range: { from: '2026-11-17', to: '2026-11-17' }, sales: [d1], refunds: [] });
    const many = { ...report, bySalesMode: Array.from({ length: 15 }, (_, i) => ({ ...report.bySalesMode[0]!, key: `m${i}`, label: `Mode ${i}`, transactions: 1, gross: 1_000, refunds: 0 })) };
    const row = toDailyRow(many, '2026-11-17', new Map(), 1);
    expect(row.modes).toHaveLength(MAX_MODES);
    expect(row.modes.at(-1)).toMatchObject({ name: 'Lainnya', transactions: 4, gross: 4_000 });
  });
});

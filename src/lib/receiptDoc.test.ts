import { describe, expect, it } from 'vitest';
import type { Order, Refund, Store } from '../types';
import { buildReceiptDoc, receiptBanner } from './receiptDoc';
import { layoutReceipt, wrap, type Measure } from './receiptImage';
import { buildReceiptMessage } from './receiptText';

const store = { name: 'Bakso Pak Budi', address: 'Jl. Melati 1', phone: '0812', receiptHeader: '', receiptFooter: 'Terima kasih', servicePct: 0, taxPct: 0, isTaxInclusive: false, timezone: 'Asia/Jakarta' } as unknown as Store;
const order: Order = {
  id: 'o1', storeId: 's1', createdAt: '', updatedAt: '', receiptNo: 'INV-20261128-A001', status: 'paid', salesModeId: 'm1', salesModeNameSnapshot: 'Takeaway',
  customerId: 'c1', customerNameSnapshot: 'Sari', label: '',
  items: [{ id: 'i1', productId: 'p1', nameSnapshot: 'Bakso Urat', unitPrice: 19_000, qty: 2, options: [{ groupId: 'g', optionId: 'o', name: 'Telur', priceDelta: 3_000 }], discount: null, note: 'kuah\npisah' }],
  orderDiscount: null,
  payments: [{ id: 'p', paymentMethodId: 'pm', methodNameSnapshot: 'Tunai', methodType: 'cash', amount: 44_000, cashReceived: 50_000, change: 6_000 }],
  totals: { subtotal: 44_000, itemDiscountTotal: 0, orderDiscountTotal: 0, serviceTotal: 0, taxTotal: 0, grandTotal: 44_000 },
  cashierId: 'k', businessDate: '2026-11-28', openedAt: '2026-11-28T05:00:00.000Z', paidAt: '2026-11-28T05:01:00.000Z',
};
const refund = (kind: Refund['kind'], amount: number) => ({ kind, amount }) as Refund;

describe('buildReceiptDoc', () => {
  const doc = buildReceiptDoc(order, store, 'Siti');
  it('holds the receipt as formatted rows, like the printed receipt', () => {
    expect(doc.shop).toEqual({ name: 'Bakso Pak Budi', address: 'Jl. Melati 1', phone: '0812', header: '' });
    expect(doc.lines).toContainEqual({ k: 'item', l: 'Bakso Urat' });
    expect(doc.lines).toContainEqual({ k: 'sub', l: '+ Telur' });
    expect(doc.lines.find((l) => l.k === 'total')?.r).toMatch(/Rp\s?44\.000/);
    expect(doc.lines.some((l) => l.r === 'Sari')).toBe(true);
    expect(doc.footer).toBe('Terima kasih');
    expect(doc.banner).toBe('');
  });
  it('never carries control characters (the server would refuse them)', () => {
    expect(JSON.stringify(doc)).not.toMatch(/\\n|\\u000/);
    expect(doc.lines).toContainEqual({ k: 'sub', l: '» kuah pisah' });
  });
  it('marks voided and refunded receipts', () => {
    expect(receiptBanner({ status: 'void' }, [])).toBe('Dibatalkan');
    expect(receiptBanner({ status: 'paid' }, [refund('void', 44_000)])).toBe('Dibatalkan');
    expect(receiptBanner({ status: 'partial_refund' }, [refund('refund', 5_000)])).toMatch(/^Dikembalikan Rp\s?5\.000$/);
  });
});

describe('receipt image layout', () => {
  const measure: Measure = (text) => text.length * 8;
  it('wraps long text at spaces and inside very long words', () => {
    expect(wrap('aaa bbb ccc', 60, '', measure)).toEqual(['aaa bbb', 'ccc']);
    expect(wrap('x'.repeat(20), 80, '', measure)).toEqual(['x'.repeat(10), 'x'.repeat(10)]);
  });
  it('grows with the receipt and adds a banner when voided', () => {
    const doc = buildReceiptDoc(order, store, 'Siti');
    const plain = layoutReceipt(doc, measure);
    const voided = layoutReceipt({ ...doc, banner: 'Dibatalkan' }, measure);
    expect(plain.height).toBeGreaterThan(300);
    expect(voided.height).toBeGreaterThan(plain.height);
    expect(voided.ops[0]).toMatchObject({ t: 'banner', text: 'Dibatalkan' });
    expect(plain.ops.filter((o) => o.t === 'text' && o.text === 'Bakso Urat')).toHaveLength(1);
  });
});

describe('buildReceiptMessage', () => {
  const link = 'https://pikul.test/r/AbCdEfGhIjKlMnOpQrStUv';
  it('online: short message with the link', () => {
    const m = buildReceiptMessage(order, store, link, true);
    expect(m).toContain('*Bakso Pak Budi*');
    expect(m).toContain('Struk INV-20261128-A001');
    expect(m).toContain(`Lihat struk: ${link}`);
    expect(m).not.toContain('Bakso Urat');
  });
  it('offline: the full text receipt plus the link', () => {
    const m = buildReceiptMessage(order, store, link, false);
    expect(m).toContain('Bakso Urat');
    expect(m.endsWith(`Lihat struk: ${link}`)).toBe(true);
  });
});

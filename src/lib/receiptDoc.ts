import { REFUND_REASON_LABEL } from '../constants';
import { DATE_LOCALE, lang, t } from '../i18n';
import type { Order, Refund, Store } from '../types';
import { formatRupiah } from './money';
import { lineGross } from './pricing';
import { formatQuantity } from './quantity';
import { totalRefunded } from './refunds';

/**
 * The receipt as rows of formatted text (ADR-028). One source for the PNG drawn on the device and for the copy
 * the server shows at /r/<token> and in the email. Same content as ReceiptView. Never holds the customer's phone or email.
 * Mirrors server/receiptTypes.ts.
 */
export type ReceiptLineKind = 'meta' | 'item' | 'sub' | 'line' | 'total' | 'rule' | 'alert' | 'note';

export interface ReceiptLine {
  k: ReceiptLineKind;
  l: string;
  r?: string;
}

export interface ReceiptDoc {
  v: 1;
  receiptNo: string;
  shop: { name: string; address: string; phone: string; header: string };
  lines: ReceiptLine[];
  footer: string;
  total: string;
  banner: string;
  lang: 'id' | 'en';
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
// Control characters would make the server refuse the copy.
const plain = (s: string, max: number) => clip(s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim(), max);

export function buildReceiptDoc(order: Order, store: Store, cashierName: string, refunds: readonly Refund[] = []): ReceiptDoc {
  const dateTime = new Intl.DateTimeFormat(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: store.timezone || undefined });
  const lines: ReceiptLine[] = [];
  const add = (k: ReceiptLineKind, l: string, r?: string) => lines.push(r === undefined ? { k, l: plain(l, 200) } : { k, l: plain(l, 200), r: plain(r, 120) });
  const { totals } = order;

  add('meta', t('No'), order.receiptNo);
  add('meta', t('Waktu'), dateTime.format(new Date(order.paidAt ?? order.openedAt)));
  add('meta', t('Kasir::orang'), cashierName);
  add('meta', t('Mode'), order.salesModeNameSnapshot);
  if (order.label) add('meta', t('Pesanan::label'), order.label);
  if (order.customerNameSnapshot) add('meta', t('Pelanggan::satu'), order.customerNameSnapshot);
  add('rule', '');

  for (const item of order.items) {
    add('item', item.nameSnapshot);
    if (item.options.length > 0) add('sub', `+ ${item.options.map((o) => o.name).join(', ')}`);
    if (item.note) add('sub', `» ${item.note}`);
    add('sub', `${formatQuantity(item.qty, item.unit)} × ${formatRupiah(item.unitPrice)}`, formatRupiah(lineGross(item)));
  }

  add('rule', '');
  add('line', t('Subtotal'), formatRupiah(totals.subtotal));
  const discount = totals.itemDiscountTotal + totals.orderDiscountTotal;
  if (discount > 0) add('line', order.orderDiscount?.name ?? t('Diskon'), `-${formatRupiah(discount)}`);
  if (totals.serviceTotal > 0) add('line', t('Service {0}%', store.servicePct), formatRupiah(totals.serviceTotal));
  if (totals.taxTotal > 0) add('line', t('Pajak {0}%{1}', store.taxPct, store.isTaxInclusive ? t(' (termasuk)') : ''), formatRupiah(totals.taxTotal));
  add('total', t('TOTAL'), formatRupiah(totals.grandTotal));

  if (order.payments.length > 0) add('rule', '');
  for (const p of order.payments) {
    add('line', p.methodNameSnapshot, formatRupiah(p.cashReceived ?? p.amount));
    if (p.reference) add('line', t('Ref'), p.reference);
    if (p.change !== undefined) add('line', t('Kembali::uang'), formatRupiah(p.change));
  }
  if (order.status === 'open') add('alert', t('** BELUM DIBAYAR **'));

  if (refunds.length > 0) add('rule', '');
  for (const r of refunds) {
    add('alert', r.kind === 'void' ? t('VOID') : t('REFUND'), `-${formatRupiah(r.amount)}`);
    add('note', `${dateTime.format(new Date(r.createdAt))} · ${REFUND_REASON_LABEL[r.reasonCode]}${r.reasonNote ? ` — ${r.reasonNote}` : ''}`);
  }

  return {
    v: 1,
    receiptNo: plain(order.receiptNo, 40),
    shop: { name: plain(store.name, 120) || 'Pikul', address: plain(store.address, 240), phone: plain(store.phone, 40), header: plain(store.receiptHeader, 240) },
    lines: lines.slice(0, 400),
    footer: plain(store.receiptFooter, 500),
    total: formatRupiah(totals.grandTotal),
    banner: receiptBanner(order, refunds),
    lang,
  };
}

/** "Dibatalkan" for a voided order, "Dikembalikan Rp5.000" after a refund, else ''. */
export function receiptBanner(order: Pick<Order, 'status'>, refunds: readonly Pick<Refund, 'kind' | 'amount'>[]): string {
  if (order.status === 'void' || order.status === 'cancelled' || refunds.some((r) => r.kind === 'void')) return t('Dibatalkan');
  const refunded = totalRefunded(refunds.filter((r) => r.kind === 'refund'));
  return refunded > 0 ? t('Dikembalikan {0}', formatRupiah(refunded)) : '';
}

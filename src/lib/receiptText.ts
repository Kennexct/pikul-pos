import type { Order, Store } from '../types';
import { formatRupiah } from './money';
import { t } from '../i18n';
import { lineGross } from './pricing';
import { formatQuantity, isMeasured } from './quantity';

const DIVIDER = '--------------------------------';

/** Plain-text receipt for WhatsApp sharing (M9). Pure function: easy to test. */
export function buildReceiptText(order: Order, store: Pick<Store, 'name' | 'address' | 'phone' | 'receiptFooter'>): string {
  const lines: string[] = [`*${store.name}*`];
  if (store.address) lines.push(store.address);
  if (store.phone) lines.push(store.phone);
  lines.push(DIVIDER, t('No: {0}', order.receiptNo), t('Mode: {0}', order.salesModeNameSnapshot));
  if (order.label) lines.push(t('Pesanan: {0}', order.label));
  if (order.customerNameSnapshot) lines.push(t('Pelanggan: {0}', order.customerNameSnapshot));
  lines.push(DIVIDER);

  for (const item of order.items) {
    const quantity = isMeasured(item.unit) ? formatQuantity(item.qty, item.unit) : `${item.qty}x`;
    lines.push(`${quantity} ${item.nameSnapshot}  ${formatRupiah(lineGross(item))}`);
    if (item.options.length > 0) lines.push(`   ${item.options.map((o) => o.name).join(', ')}`);
    if (item.note) lines.push(t('   Catatan: {0}', item.note));
  }

  const { totals } = order;
  lines.push(DIVIDER, t('Subtotal  {0}', formatRupiah(totals.subtotal)));
  const discount = totals.itemDiscountTotal + totals.orderDiscountTotal;
  if (discount > 0) lines.push(t('Diskon  -{0}', formatRupiah(discount)));
  if (totals.serviceTotal > 0) lines.push(t('Service  {0}', formatRupiah(totals.serviceTotal)));
  if (totals.taxTotal > 0) lines.push(t('Pajak  {0}', formatRupiah(totals.taxTotal)));
  lines.push(t('*Total  {0}*', formatRupiah(totals.grandTotal)));

  for (const payment of order.payments) {
    lines.push(`${payment.methodNameSnapshot}  ${formatRupiah(payment.cashReceived ?? payment.amount)}`);
    if (payment.reference) lines.push(t('Ref: {0}', payment.reference));
    if (payment.change !== undefined && payment.change > 0) lines.push(t('Kembali  {0}', formatRupiah(payment.change)));
  }
  if (store.receiptFooter) lines.push(DIVIDER, store.receiptFooter);
  return lines.join('\n');
}

/**
 * WhatsApp message with the web receipt link (ADR-028): short, the link carries the full receipt and its picture.
 * Offline the link opens only after the device syncs, so the full text goes along too.
 */
export function buildReceiptMessage(order: Order, store: Pick<Store, 'name' | 'address' | 'phone' | 'receiptFooter'>, link: string, isOnline: boolean): string {
  if (!isOnline) return `${buildReceiptText(order, store)}\n\n${t('Lihat struk: {0}', link)}`;
  const lines = [`*${store.name}*`, t('Terima kasih sudah berbelanja.'), '', t('Struk {0}', order.receiptNo), t('*Total  {0}*', formatRupiah(order.totals.grandTotal))];
  const payment = order.payments[0];
  if (payment) lines.push(payment.methodNameSnapshot);
  lines.push('', t('Lihat struk: {0}', link));
  return lines.join('\n');
}

/** With a phone (`+628…`) the chat opens directly with that customer; without, WhatsApp asks whom to send to. */
export function whatsAppShareUrl(text: string, phone?: string): string {
  return `https://wa.me/${phone ? phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(text)}`;
}

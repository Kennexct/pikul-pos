import { formatRupiah } from '../../lib/money';
import { REFUND_REASON_LABEL } from '../../constants';
import type { Order, Refund, Store } from '../../types';
import { DATE_LOCALE, t } from '../../i18n';
import { lineGross } from '../../lib/pricing';
import { formatQuantity } from '../../lib/quantity';

interface ReceiptViewProps {
  order: Order;
  store: Store;
  cashierName: string;
  refunds?: readonly Refund[];
}

const dateTime = new Intl.DateTimeFormat(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

/** M9 receipt layout styled as thermal paper; `.receipt` is what @media print shows (58/80 mm). */
export function ReceiptView({ order, store, cashierName, refunds = [] }: ReceiptViewProps) {
  const { totals } = order;
  const discount = totals.itemDiscountTotal + totals.orderDiscountTotal;

  return (
    <article
      className="receipt relative mx-auto w-full max-w-[300px] bg-surface px-5 pb-6 pt-5 font-mono text-[12.5px] leading-[1.55] text-ink shadow-xs [mask:conic-gradient(from_-45deg_at_bottom,#0000,#000_1deg_89deg,#0000_90deg)_50%/12px_100%]"
      data-paper={store.receiptPaperMm}
    >
      <header className="mb-3 text-center font-sans">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">{store.name}</p>
        {store.address && <p className="text-[12px] text-muted">{store.address}</p>}
        {store.phone && <p className="text-[12px] text-muted">{store.phone}</p>}
        {store.receiptHeader && <p className="mt-1 text-[12px] text-ink-soft">{store.receiptHeader}</p>}
      </header>

      <Divider />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-ink-soft">
        <dt>{t('No')}</dt><dd className="text-right">{order.receiptNo}</dd>
        <dt>{t('Waktu')}</dt><dd className="text-right">{dateTime.format(new Date(order.paidAt ?? order.openedAt))}</dd>
        <dt>{t('Kasir::orang')}</dt><dd className="text-right">{cashierName}</dd>
        <dt>{t('Mode')}</dt><dd className="text-right">{order.salesModeNameSnapshot}</dd>
        {order.label && (<><dt>{t('Pesanan::label')}</dt><dd className="text-right">{order.label}</dd></>)}
        {order.customerNameSnapshot && (<><dt>{t('Pelanggan::satu')}</dt><dd className="text-right">{order.customerNameSnapshot}</dd></>)}
      </dl>
      <Divider />

      <ul className="flex flex-col gap-1.5">
        {order.items.map((item) => (
          <li key={item.id}>
            <p className="font-semibold">{item.nameSnapshot}</p>
            {item.options.length > 0 && <p className="pl-2 text-muted">+ {item.options.map((o) => o.name).join(', ')}</p>}
            {item.note && <p className="pl-2 text-muted">» {item.note}</p>}
            <p className="flex justify-between pl-2">
              <span>{formatQuantity(item.qty, item.unit)} × {formatRupiah(item.unitPrice)}</span>
              <span>{formatRupiah(lineGross(item))}</span>
            </p>
          </li>
        ))}
      </ul>

      <Divider />
      <Line label={t('Subtotal')} value={formatRupiah(totals.subtotal)} />
      {discount > 0 && <Line label={order.orderDiscount?.name ?? t('Diskon')} value={`-${formatRupiah(discount)}`} />}
      {totals.serviceTotal > 0 && <Line label={t('Service {0}%', store.servicePct)} value={formatRupiah(totals.serviceTotal)} />}
      {totals.taxTotal > 0 && <Line label={t('Pajak {0}%{1}', store.taxPct, store.isTaxInclusive ? t(' (termasuk)') : '')} value={formatRupiah(totals.taxTotal)} />}
      <p className="mt-1 flex justify-between text-[14px] font-semibold">
        <span>{t('TOTAL')}</span>
        <span>{formatRupiah(totals.grandTotal)}</span>
      </p>

      {order.payments.length > 0 && <Divider />}
      {order.payments.map((payment) => (
        <div key={payment.id}>
          <Line label={payment.methodNameSnapshot} value={formatRupiah(payment.cashReceived ?? payment.amount)} />
          {payment.reference && <Line label={t('Ref')} value={payment.reference} />}
          {payment.change !== undefined && <Line label={t('Kembali::uang')} value={formatRupiah(payment.change)} />}
        </div>
      ))}
      {order.status === 'open' && <p className="mt-2 text-center font-semibold">{t('** BELUM DIBAYAR **')}</p>}

      {refunds.length > 0 && <Divider />}
      {refunds.map((refund) => (
        <div key={refund.id} className="text-danger-700">
          <Line label={refund.kind === 'void' ? t('VOID') : t('REFUND')} value={`-${formatRupiah(refund.amount)}`} />
          <p className="pl-2 text-[11.5px]">
            {dateTime.format(new Date(refund.createdAt))} · {REFUND_REASON_LABEL[refund.reasonCode]}
            {refund.reasonNote ? ` — ${refund.reasonNote}` : ''}
          </p>
        </div>
      ))}

      {store.receiptFooter && (
        <>
          <Divider />
          <p className="text-center font-sans text-[12px] text-ink-soft">{store.receiptFooter}</p>
        </>
      )}
    </article>
  );
}

function Divider() {
  return <hr className="my-2.5 border-0 border-t border-dashed border-line-strong" />;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}

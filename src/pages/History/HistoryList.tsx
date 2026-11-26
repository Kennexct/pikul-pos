import { ChevronRight, ReceiptText } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { card } from '../../components/ui/styles';
import { formatBusinessDate } from '../../lib/dateRange';
import { formatRupiah } from '../../lib/money';
import type { BusinessDate, Id, Order } from '../../types';
import { DATE_LOCALE, t } from '../../i18n';
import { formatLineQty } from '../../lib/quantity';

const timeFormat = new Intl.DateTimeFormat(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' });
const COLUMNS = '@4xl/page:grid-cols-[64px_minmax(150px,190px)_1fr_120px_130px_120px_20px]';

interface HistoryListProps {
  orders: Order[];
  onSelect: (orderId: Id) => void;
}

function groupByDate(orders: Order[]): Array<[BusinessDate, Order[]]> {
  const groups = new Map<BusinessDate, Order[]>();
  for (const order of orders) groups.set(order.businessDate, [...(groups.get(order.businessDate) ?? []), order]);
  return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
}

const isStruckThrough = (order: Order) => order.status === 'void' || order.status === 'cancelled';

export function HistoryList({ orders, onSelect }: HistoryListProps) {
  if (orders.length === 0) {
    return <EmptyState icon={ReceiptText} title={t('Belum ada transaksi')} description={t('Tidak ada transaksi pada periode dan filter ini.')} />;
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={`hidden items-center gap-4 border-b border-line bg-subtle px-4 py-2.5 text-[12px] font-semibold text-muted @4xl/page:grid ${COLUMNS}`}>
        <span>{t('Jam')}</span>
        <span>{t('No. struk')}</span>
        <span>{t('Pesanan::label')}</span>
        <span>{t('Pembayaran')}</span>
        <span>{t('Status')}</span>
        <span className="text-right">{t('Total')}</span>
        <span />
      </div>
      {groupByDate(orders).map(([date, group]) => (
        <section key={date}>
          <h3 className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 text-[13px] font-semibold text-ink-soft backdrop-blur">
            <span>{formatBusinessDate(date)}</span>
            <span className="num text-muted">{t('{0} transaksi', group.length)}</span>
          </h3>
          <ul className="divide-y divide-line">
            {group.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onSelect(order.id)}
                  className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-subtle @4xl/page:gap-4 ${COLUMNS}`}
                >
                  <span className="num hidden text-[14px] text-ink-soft @4xl/page:block">{timeFormat.format(new Date(order.paidAt ?? order.updatedAt))}</span>
                  <span className="min-w-0">
                    <span className="num block truncate text-[14px] font-semibold">{order.receiptNo}</span>
                    <span className="num block truncate text-[13px] text-muted @4xl/page:hidden">
                      {timeFormat.format(new Date(order.paidAt ?? order.updatedAt))} · {order.payments[0]?.methodNameSnapshot ?? '—'} · {order.salesModeNameSnapshot}
                      {order.customerNameSnapshot ? ` · ${order.customerNameSnapshot}` : ''}
                    </span>
                  </span>
                  <span className="hidden min-w-0 truncate text-[14px] text-ink-soft @4xl/page:block">
                    {[order.customerNameSnapshot, order.label].filter(Boolean).map((part) => `${part} · `).join('')}
                    {order.items.map((i) => `${formatLineQty(i)} ${i.nameSnapshot}`).join(', ')}
                  </span>
                  <span className="hidden text-[14px] text-ink-soft @4xl/page:block">{order.payments[0]?.methodNameSnapshot ?? '—'}</span>
                  <span className="hidden @4xl/page:block"><StatusBadge status={order.status} /></span>
                  <span className="flex flex-col items-end gap-1 @4xl/page:block @4xl/page:text-right">
                    <span className={`num text-[15px] font-semibold ${isStruckThrough(order) ? 'text-muted line-through' : ''}`}>
                      {formatRupiah(order.totals.grandTotal)}
                    </span>
                    {order.status !== 'paid' && <span className="@4xl/page:hidden"><StatusBadge status={order.status} /></span>}
                  </span>
                  <ChevronRight aria-hidden size={18} className="hidden text-faint @4xl/page:block" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

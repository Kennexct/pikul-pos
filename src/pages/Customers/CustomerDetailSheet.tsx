import { MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Sheet } from '../../components/ui/Sheet';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { btnDanger, btnGhost, btnSecondary, sectionTitle } from '../../components/ui/styles';
import { ROUTES } from '../../constants';
import { useCustomerOrders } from '../../hooks/useCustomers';
import { buildDebtReminder, formatPhone, toWhatsAppNumber, type CustomerStats } from '../../lib/customers';
import { formatRupiah } from '../../lib/money';
import { whatsAppShareUrl } from '../../lib/receiptText';
import type { Customer } from '../../types';
import { DATE_LOCALE, t } from '../../i18n';
import { formatLineQty } from '../../lib/quantity';

const RECENT_ORDERS = 5;
const dateFormat = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
export const formatVisit = (iso: string | null): string => (iso ? dateFormat.format(new Date(iso)) : '—');
/** Fits a third-width stat tile on a phone ("18 Nov 26"). */
const shortDate = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', year: '2-digit' });

interface CustomerDetailSheetProps {
  customer: Customer;
  stats: CustomerStats;
  /** Used in the payment reminder text. */
  storeName: string;
  timeZone: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line px-3 py-2.5">
      <dt className="truncate text-[12px] text-muted">{label}</dt>
      <dd className="num truncate text-[16px] font-semibold">{value}</dd>
    </div>
  );
}

export function CustomerDetailSheet({ customer, stats, storeName, timeZone, onEdit, onDelete, onClose }: CustomerDetailSheetProps) {
  const orders = useCustomerOrders(customer.id);
  const unpaid = (orders ?? []).filter((o) => o.status === 'open').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const settled = (orders ?? []).filter((o) => o.status !== 'open');
  const reminder = unpaid.length > 0 ? buildDebtReminder({ storeName, customerName: customer.name, orders: unpaid, timeZone }) : '';

  return (
    <Sheet
      title={customer.name}
      subtitle={customer.phone ? formatPhone(customer.phone) : t('Tanpa nomor HP')}
      isOpen
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onDelete} className={btnDanger}>
            <Trash2 aria-hidden size={18} /> {t('Hapus')}
          </button>
          <button type="button" onClick={onEdit} className={btnSecondary}>
            <Pencil aria-hidden size={18} /> {t('Ubah')}
          </button>
        </div>
      }
    >
      <dl className="mb-4 grid grid-cols-3 gap-2">
        <Stat label={t('Kunjungan')} value={String(stats.visits)} />
        <Stat label={t('Total belanja')} value={formatRupiah(stats.totalSpend)} />
        <Stat label={t('Terakhir')} value={stats.lastVisitAt ? shortDate.format(new Date(stats.lastVisitAt)) : '—'} />
      </dl>

      {customer.phone && unpaid.length === 0 && (
        <a href={`https://wa.me/${toWhatsAppNumber(customer.phone)}`} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} mb-4 w-full`}>
          <MessageCircle aria-hidden size={18} /> {t('Chat WhatsApp')}
        </a>
      )}
      {customer.note && <p className="mb-4 rounded-lg bg-subtle px-3.5 py-2.5 text-[14px] text-ink-soft">{customer.note}</p>}
      {unpaid.length > 0 && (
        <section aria-label={t('Belum dibayar')} className="mb-4 overflow-hidden rounded-lg border border-warn-200">
          <header className="flex items-end justify-between gap-3 bg-warn-50 px-3.5 py-2.5">
            <div>
              <h3 className="text-[13px] font-semibold text-warn-700">{t('Belum dibayar')}</h3>
              <p className="num text-[13px] text-warn-700">{t('{0} pesanan', unpaid.length)}</p>
            </div>
            <p className="num text-[20px] font-semibold leading-none tracking-[-0.02em] text-ink">{formatRupiah(stats.openAmount)}</p>
          </header>
          <ul className="divide-y divide-line">
            {unpaid.map((order) => (
              <li key={order.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{order.label || t('Pesanan tersimpan')}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {formatVisit(order.createdAt)} · {order.items.map((i) => `${formatLineQty(i)} ${i.nameSnapshot}`).join(', ')}
                  </span>
                </span>
                <span className="num text-[14px] font-semibold">{formatRupiah(order.totals.grandTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1 border-t border-line px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-2">
            {customer.phone ? (
              <a href={whatsAppShareUrl(reminder, customer.phone)} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} h-11 text-[14px] sm:flex-1`}>
                <MessageCircle aria-hidden size={17} /> {t('Ingatkan via WhatsApp')}
              </a>
            ) : (
              <p className="flex-1 text-[13px] text-muted">{t('Tambahkan nomor HP untuk mengirim pengingat.')}</p>
            )}
            <Link to={ROUTES.openOrders} className={`${btnGhost} text-[14px]`}>{t('Terima bayaran')}</Link>
          </div>
        </section>
      )}

      <h3 className={`${sectionTitle} mb-2`}>{t('Transaksi terakhir')}</h3>
      {orders && settled.length === 0 ? (
        <p className="text-[14px] text-muted">{t('Belum ada transaksi.')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {settled.slice(0, RECENT_ORDERS).map((order) => (
            <li key={order.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="num block truncate text-[14px] font-semibold">{order.receiptNo}</span>
                <span className="block truncate text-[13px] text-muted">{order.items.map((i) => `${formatLineQty(i)} ${i.nameSnapshot}`).join(', ')}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="num text-[14px] font-semibold">{formatRupiah(order.totals.grandTotal)}</span>
                {order.status !== 'paid' && <StatusBadge status={order.status} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

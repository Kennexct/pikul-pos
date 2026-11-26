import { ChevronRight, CircleCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { card } from '../../components/ui/styles';
import type { CustomerStats } from '../../lib/customers';
import { formatRupiah } from '../../lib/money';
import type { Customer, Id } from '../../types';
import { formatVisit } from './CustomerDetailSheet';
import { t } from '../../i18n';

interface DebtListProps {
  /** Customers with at least one unpaid order, already filtered by the search box. */
  debtors: ReadonlyArray<{ customer: Customer; stats: CustomerStats }>;
  hasQuery: boolean;
  onOpen: (customerId: Id) => void;
}

/** "Belum bayar": who still owes, how much, and since when — longest-waiting first. */
export function DebtList({ debtors, hasQuery, onOpen }: DebtListProps) {
  if (debtors.length === 0) {
    return hasQuery ? (
      <EmptyState icon={CircleCheck} title={t('Tidak ditemukan')} description={t('Tidak ada pelanggan dengan nama atau nomor itu yang belum bayar.')} />
    ) : (
      <EmptyState icon={CircleCheck} title={t('Tidak ada yang belum bayar')} description={t('Pesanan yang disimpan atas nama pelanggan muncul di sini sampai dibayar.')} />
    );
  }

  const total = debtors.reduce((sum, d) => sum + d.stats.openAmount, 0);
  const orderCount = debtors.reduce((sum, d) => sum + d.stats.openOrders, 0);

  return (
    <>
      <div className={`${card} mb-3 flex items-end justify-between gap-4 px-4 py-3.5`}>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-soft">{t('Total belum dibayar')}</p>
          <p className="num text-[13px] text-muted">{t('{0} pelanggan · {1} pesanan', debtors.length, orderCount)}</p>
        </div>
        <p className="num text-[24px] font-semibold leading-none tracking-[-0.02em]">{formatRupiah(total)}</p>
      </div>
      <ul className={`${card} divide-y divide-line overflow-hidden`}>
        {debtors.map(({ customer, stats }) => (
          <li key={customer.id}>
            <button type="button" onClick={() => onOpen(customer.id)} className="grid w-full grid-cols-[1fr_auto_20px] items-center gap-3 px-4 py-3 text-left hover:bg-subtle">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{customer.name}</span>
                <span className="num block truncate text-[13px] text-muted">
                  {stats.openOrders} {t('pesanan · sejak')} {formatVisit(stats.oldestOpenAt)}
                </span>
              </span>
              <span className="num text-right text-[15px] font-semibold">{formatRupiah(stats.openAmount)}</span>
              <ChevronRight aria-hidden size={18} className="text-faint" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

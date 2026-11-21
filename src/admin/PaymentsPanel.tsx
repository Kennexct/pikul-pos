import { ChevronLeft, ChevronRight, Download, Wallet } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { StatTile } from '../components/ui/StatTile';
import { btnIcon, btnSecondary, card } from '../components/ui/styles';
import { t } from '../i18n';
import { downloadCsv, loadPayments } from './api';
import { errorText } from './errors';
import { fmtDate, fmtMonth, METHOD_LABEL, num, rp, todayWib } from './format';
import { LoadError, PanelHead } from './ui';
import { useLoad } from './useLoad';

const shiftMonth = (m: string, by: number) => {
  const [y = 2026, mo = 1] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

/** Subscription payments by month (ADR-020): what came in, how, and the CSV for bookkeeping. */
export function PaymentsPanel({ onOpenMerchant, onError }: { onOpenMerchant: (id: string) => void; onError: (e: unknown) => Promise<void> }) {
  const thisMonth = todayWib().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { data, error, reload } = useLoad(() => loadPayments(month), [month], onError);
  const exportCsv = async () => {
    try {
      await downloadCsv(`/api/admin/payments?month=${month}&format=csv`, `pembayaran-pikul-${month}.csv`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-4">
      <PanelHead
        title={t('Pembayaran langganan')}
        hint={t('Catat pembayaran dari halaman merchant. Pembatalan tetap tersimpan sebagai riwayat.')}
        actions={
          <button type="button" className={btnSecondary} onClick={() => void exportCsv()} disabled={!data || data.rows.length === 0}>
            <Download aria-hidden size={18} />
            {t('Unduh CSV')}
          </button>
        }
      />
      <div className="flex items-center gap-2">
        <button type="button" className={btnIcon} onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label={t('Bulan sebelumnya')}>
          <ChevronLeft aria-hidden size={18} />
        </button>
        <span className="min-w-[9rem] text-center text-[16px] font-semibold text-ink">{fmtMonth(month)}</span>
        <button type="button" className={btnIcon} onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= thisMonth} aria-label={t('Bulan berikutnya')}>
          <ChevronRight aria-hidden size={18} />
        </button>
      </div>
      {error && !data ? (
        <LoadError error={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingScreen message={t('Memuat…')} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile isPrimary label={t('Uang masuk')} value={rp(data.total)} />
            <StatTile label={t('Pembayaran')} value={num(data.count)} />
            <StatTile label={t('Dibatalkan')} value={num(data.cancelled)} />
          </div>
          {data.rows.length === 0 ? (
            <EmptyState icon={Wallet} title={t('Belum ada pembayaran bulan ini')} description={t('Buka merchant lalu pilih Catat pembayaran setelah uang diterima.')} />
          ) : (
            <ul className={`${card} divide-y divide-line`}>
              {data.rows.map((p) => {
                const isCancelled = p.cancelledAt !== null;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => onOpenMerchant(p.accountId)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 text-left hover:bg-subtle">
                      <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{p.email}</span>
                      <span className={`num text-[15px] font-semibold ${isCancelled ? 'text-muted line-through' : 'text-ink'}`}>{rp(p.amount)}</span>
                      <span className="text-[13px] text-muted">
                        {fmtDate(Date.parse(`${p.paidOn}T00:00:00+07:00`))} · {METHOD_LABEL[p.method]} · {p.planName ?? t('{0} hari', p.days)}
                      </span>
                      <span className={`text-[13px] ${isCancelled ? 'text-danger-700' : 'text-muted'}`}>{isCancelled ? t('Dibatalkan') : p.reference}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

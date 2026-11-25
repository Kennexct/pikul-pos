import { CalendarCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { card } from '../../components/ui/styles';
import { formatBusinessDate } from '../../lib/dateRange';
import { formatRupiah } from '../../lib/money';
import { shiftNoOf } from '../../lib/shifts';
import type { DayClosing, Id } from '../../types';
import { DifferenceBadge } from './DifferenceBadge';
import { t } from '../../i18n';

interface ClosingHistoryProps {
  closings: readonly DayClosing[];
  memberNames: ReadonlyMap<Id, string>;
}

const COLUMNS = 'md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]';

/** Past closings, newest first: sales, expected vs counted cash, and the difference. */
export function ClosingHistory({ closings, memberNames }: ClosingHistoryProps) {
  // A day with more than one shift names each row's shift (ADR-027).
  const shiftDays = new Set(closings.filter((c) => shiftNoOf(c) > 1).map((c) => c.businessDate));
  if (closings.length === 0) {
    return <EmptyState icon={CalendarCheck} title={t('Belum pernah tutup kasir')} description={t('Setelah kasir ditutup, hasil hitung uang laci setiap hari tersimpan di sini.')} />;
  }
  return (
    <div className={`${card} overflow-hidden`}>
      <div className={`hidden gap-3 border-b border-line bg-subtle px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted md:grid ${COLUMNS}`}>
        <span>{t('Hari')}</span>
        <span className="text-right">{t('Penjualan bersih')}</span>
        <span className="text-right">{t('Seharusnya')}</span>
        <span className="text-right">{t('Dihitung')}</span>
        <span className="w-[130px] text-right">{t('Selisih')}</span>
      </div>
      <ul className="divide-y divide-line">
        {closings.map((closing) => (
          <li key={closing.id} className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 ${COLUMNS}`}>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">
                {formatBusinessDate(closing.businessDate)}
                {shiftDays.has(closing.businessDate) && <span className="font-normal text-muted"> · {t('Shift {0}', shiftNoOf(closing))}</span>}
              </p>
              <p className="truncate text-[13px] text-muted">
                {memberNames.get(closing.closedById) ?? t('Kasir::orang')}
                <span className="num md:hidden"> {t('· jual')} {formatRupiah(closing.netSales)} {t('· laci')} {formatRupiah(closing.countedCash)}</span>
                {closing.note ? ` · ${closing.note}` : ''}
              </p>
            </div>
            <span className="num hidden text-right text-[14px] md:block">{formatRupiah(closing.netSales)}</span>
            <span className="num hidden text-right text-[14px] md:block">{formatRupiah(closing.expectedCash)}</span>
            <span className="num hidden text-right text-[14px] font-semibold md:block">{formatRupiah(closing.countedCash)}</span>
            <span className="flex justify-end md:w-[130px]"><DifferenceBadge difference={closing.difference} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

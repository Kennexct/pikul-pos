import { ChevronRight } from 'lucide-react';
import { card, sectionTitle } from '../../components/ui/styles';
import type { ShiftDrawer } from '../../hooks/useCash';
import { formatRupiah } from '../../lib/money';
import { formatClockTime } from '../../lib/shifts';
import { DifferenceBadge } from './DifferenceBadge';
import { t } from '../../i18n';

interface ShiftsDayCardProps {
  shifts: readonly ShiftDrawer[];
  selected: number;
  timeZone: string;
  onSelect: (shiftNo: number) => void;
}

/** Kas → the day across shifts (ADR-027): each shift on its own row, and the day's total. Shown from the second shift on. */
export function ShiftsDayCard({ shifts, selected, timeZone, onSelect }: ShiftsDayCardProps) {
  const total = shifts.reduce(
    (sum, s) => ({
      net: sum.net + s.drawer.netSales,
      transactions: sum.transactions + s.drawer.transactions,
      expenses: sum.expenses + s.drawer.expensesTotal,
      difference: sum.difference + (s.closing?.difference ?? 0),
    }),
    { net: 0, transactions: 0, expenses: 0, difference: 0 },
  );
  const closedCount = shifts.filter((s) => s.closing).length;

  return (
    <section className={`${card} p-4 md:p-5`} aria-labelledby="day-shifts">
      <h2 id="day-shifts" className={sectionTitle}>{t('Semua shift hari ini')}</h2>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {shifts.map((s) => (
          <li key={s.shiftNo}>
            <button
              type="button"
              onClick={() => onSelect(s.shiftNo)}
              aria-current={s.shiftNo === selected ? 'true' : undefined}
              className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 text-left hover:bg-subtle ${s.shiftNo === selected ? 'bg-brand-50' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{t('Shift {0}', s.shiftNo)}</span>
                <span className="num block text-[13px] text-muted">
                  {s.closing ? t('Ditutup {0}', formatClockTime(s.closing.closedAt, timeZone)) : t('Sedang berjalan')} · {t('{0} transaksi', s.drawer.transactions)}
                </span>
              </span>
              <span className="num text-[14px] font-semibold">{formatRupiah(s.drawer.netSales)}</span>
              {s.closing ? <DifferenceBadge difference={s.closing.difference} /> : <span className="text-[12px] font-semibold text-muted">{t('Belum tutup')}</span>}
              <ChevronRight aria-hidden size={16} className="text-faint" />
            </button>
          </li>
        ))}
      </ul>
      <dl className="mt-2 flex flex-col gap-1.5 border-t border-line pt-3 text-[14px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="font-semibold">{t('Total hari ini')}</dt>
          <dd className="num text-[18px] font-semibold">{formatRupiah(total.net)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-ink-soft">
          <dt>{t('Transaksi')}</dt>
          <dd className="num">{total.transactions}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-ink-soft">
          <dt>{t('Pengeluaran')}</dt>
          <dd className="num">{formatRupiah(total.expenses)}</dd>
        </div>
        {closedCount > 0 && (
          <div className="flex items-center justify-between gap-3 text-ink-soft">
            <dt>{t('Selisih laci ({0} shift ditutup)', closedCount)}</dt>
            <dd><DifferenceBadge difference={total.difference} /></dd>
          </div>
        )}
      </dl>
    </section>
  );
}

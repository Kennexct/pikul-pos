import { Plus, ReceiptText, Trash2 } from 'lucide-react';
import { DateRangeControl } from '../../components/ui/DateRangeControl';
import { EmptyState } from '../../components/ui/EmptyState';
import { badgeNeutral, btnSecondary, card } from '../../components/ui/styles';
import { EXPENSE_CATEGORY_LABEL } from '../../constants';
import type { DateRangeState } from '../../hooks/useDateRange';
import { formatBusinessDate } from '../../lib/dateRange';
import { formatRupiah } from '../../lib/money';
import type { BusinessDate, Expense, Id } from '../../types';
import { t } from '../../i18n';

interface ExpensesPanelProps {
  dateRange: DateRangeState;
  today: BusinessDate;
  expenses: readonly Expense[];
  memberNames: ReadonlyMap<Id, string>;
  onAdd: () => void;
  onDelete: (expense: Expense) => void;
}

/** Expenses of a period: total, then one row per expense (category, note, who, drawer or not). */
export function ExpensesPanel({ dateRange, today, expenses, memberNames, onAdd, onDelete }: ExpensesPanelProps) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const fromDrawer = expenses.filter((e) => e.isFromDrawer).reduce((sum, e) => sum + e.amount, 0);
  const isMultiDay = dateRange.range.from !== dateRange.range.to;

  return (
    <div className="flex flex-col gap-3">
      <DateRangeControl state={dateRange} today={today} />
      {expenses.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={t('Belum ada pengeluaran')}
          description={t('Catat belanja bahan, gas, upah, dan biaya lain supaya untung bisa dihitung.')}
          action={
            <button type="button" onClick={onAdd} className={btnSecondary}>
              <Plus aria-hidden size={18} /> {t('Catat pengeluaran')}
            </button>
          }
        />
      ) : (
        <>
          <div className={`${card} flex items-end justify-between gap-4 px-4 py-3.5`}>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink-soft">{t('Total pengeluaran')}</p>
              <p className="num text-[13px] text-muted">{expenses.length} {t('catatan · dari laci')} {formatRupiah(fromDrawer)}</p>
            </div>
            <p className="num text-[24px] font-semibold leading-none tracking-[-0.02em]">{formatRupiah(total)}</p>
          </div>
          <ul className={`${card} divide-y divide-line overflow-hidden`}>
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center gap-3 py-2 pl-4 pr-1.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{EXPENSE_CATEGORY_LABEL[expense.category]}</span>
                    {!expense.isFromDrawer && <span className={`${badgeNeutral} shrink-0`}>{t('Bukan dari laci')}</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {[isMultiDay ? formatBusinessDate(expense.businessDate) : null, expense.note || null, memberNames.get(expense.actorId) ?? null].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="num text-[15px] font-semibold">{formatRupiah(expense.amount)}</span>
                <button type="button" aria-label={t('Hapus pengeluaran {0} {1}', EXPENSE_CATEGORY_LABEL[expense.category], formatRupiah(expense.amount))} onClick={() => onDelete(expense)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-danger-50 hover:text-danger-700">
                  <Trash2 aria-hidden size={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

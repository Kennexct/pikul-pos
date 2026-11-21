import { SearchInput } from '../../components/ui/SearchInput';
import { DateRangeControl } from '../../components/ui/DateRangeControl';
import { Select } from '../../components/ui/Select';
import { ORDER_STATUS_LABEL } from '../../constants';
import type { DateRangeState } from '../../hooks/useDateRange';
import type { Id, OrderStatus, PaymentMethod, SalesMode } from '../../types';
import { t } from '../../i18n';

export interface HistoryFilter {
  status: 'all' | OrderStatus;
  paymentMethodId: 'all' | Id;
  salesModeId: 'all' | Id;
  query: string;
}

export const EMPTY_FILTER: HistoryFilter = { status: 'all', paymentMethodId: 'all', salesModeId: 'all', query: '' };

export const isFilterEmpty = (f: HistoryFilter): boolean =>
  f.status === 'all' && f.paymentMethodId === 'all' && f.salesModeId === 'all' && f.query.trim() === '';

const STATUS_FILTERS: ReadonlyArray<OrderStatus> = ['paid', 'partial_refund', 'refunded', 'void', 'cancelled'];

interface HistoryFiltersProps {
  dateRange: DateRangeState;
  today: string;
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  /** Current ones plus any removed ones that still appear in the period's sales. */
  paymentMethods: ReadonlyArray<Pick<PaymentMethod, 'id' | 'name'>>;
  salesModes: ReadonlyArray<Pick<SalesMode, 'id' | 'name'>>;
}

export function HistoryFilters(props: HistoryFiltersProps) {
  const { dateRange, today, filter, onFilterChange, paymentMethods, salesModes } = props;
  const set = (patch: Partial<HistoryFilter>) => onFilterChange({ ...filter, ...patch });
  const hasFilters = !isFilterEmpty(filter);

  return (
    <div className="flex flex-col gap-3 pb-3">
      <DateRangeControl state={dateRange} today={today} />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="lg:max-w-xs lg:flex-1">
          <SearchInput value={filter.query} onChange={(query) => set({ query })} placeholder={t('No. struk, label, pelanggan…')} label={t('Cari transaksi')} />
        </div>
        <div className="scroll-x -mx-4 flex gap-2 px-4 md:mx-0 md:px-0">
          <Select
            label={t('Status')}
            value={filter.status}
            isActive={filter.status !== 'all'}
            onChange={(status) => set({ status: status as HistoryFilter['status'] })}
            options={[{ value: 'all', label: t('Semua status') }, ...STATUS_FILTERS.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))]}
          />
          <Select
            label={t('Metode pembayaran')}
            value={filter.paymentMethodId}
            isActive={filter.paymentMethodId !== 'all'}
            onChange={(paymentMethodId) => set({ paymentMethodId })}
            options={[{ value: 'all', label: t('Semua metode') }, ...paymentMethods.map((m) => ({ value: m.id, label: m.name }))]}
          />
          <Select
            label={t('Mode penjualan')}
            value={filter.salesModeId}
            isActive={filter.salesModeId !== 'all'}
            onChange={(salesModeId) => set({ salesModeId })}
            options={[{ value: 'all', label: t('Semua mode') }, ...salesModes.map((m) => ({ value: m.id, label: m.name }))]}
          />
          {hasFilters && (
            <button type="button" onClick={() => onFilterChange(EMPTY_FILTER)} className="h-11 shrink-0 rounded-lg px-3 text-[14px] font-semibold text-brand-700 hover:bg-brand-50">
              {t('Reset')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { CalendarRange } from 'lucide-react';
import type { DateRangeState } from '../../hooks/useDateRange';
import type { RangePreset } from '../../lib/dateRange';
import { SegmentedControl } from './SegmentedControl';
import { inputBase } from './styles';
import { t } from '../../i18n';

const PRESET_OPTIONS: ReadonlyArray<{ value: RangePreset; label: string }> = [
  { value: 'today', label: t('Hari ini') },
  { value: 'yesterday', label: t('Kemarin') },
  { value: 'last7', label: t('7 hari') },
  { value: 'month', label: t('Bulan ini') },
  { value: 'custom', label: t('Pilih tanggal') },
];

interface DateRangeControlProps {
  state: DateRangeState;
  today: string;
}

export function DateRangeControl({ state, today }: DateRangeControlProps) {
  const { preset, setPreset, customRange, setCustomRange, rangeError } = state;
  return (
    <div className="flex flex-col gap-3">
      <div className="scroll-x -mx-4 px-4 md:mx-0 md:px-0">
        <SegmentedControl label={t('Periode')} options={PRESET_OPTIONS} value={preset} onChange={setPreset} />
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <CalendarRange aria-hidden size={18} className="mb-3.5 text-muted" />
          <label className="flex flex-col text-[13px] font-semibold text-ink-soft">
            {t('Dari')}
            <input type="date" value={customRange.from} max={today} onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })} className={`${inputBase} num mt-1 h-11 w-[170px]`} />
          </label>
          <label className="flex flex-col text-[13px] font-semibold text-ink-soft">
            {t('Sampai')}
            <input type="date" value={customRange.to} max={today} onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })} className={`${inputBase} num mt-1 h-11 w-[170px]`} />
          </label>
          {rangeError && <p role="alert" className="mb-3 text-[13px] text-danger-700">{rangeError}</p>}
        </div>
      )}
    </div>
  );
}

import { Calculator, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { DENOMINATIONS, isCoin, sumDenominations } from '../../lib/denominations';
import { formatRupiah } from '../../lib/money';
import { t } from '../../i18n';

interface CashCounterProps {
  /** Called with the new total each time a count changes. */
  onTotal: (total: number) => void;
}

const MAX_COUNT = 9999;

/** Optional "Hitung per pecahan": count each note and coin, the total fills the amount field (ADR-017). */
export function CashCounter({ onTotal }: CashCounterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<Record<number, number | undefined>>({});

  const setCount = (value: number, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    const next = { ...counts, [value]: digits === '' ? undefined : Math.min(Number(digits), MAX_COUNT) };
    setCounts(next);
    onTotal(sumDenominations(next));
  };

  return (
    <div className="rounded-lg border border-line">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="cash-counter"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-full items-center gap-2 px-3 text-left text-[14px] font-semibold text-brand-700"
      >
        <Calculator aria-hidden size={17} />
        <span className="flex-1">{t('Hitung per pecahan')}</span>
        <ChevronDown aria-hidden size={17} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div id="cash-counter" className="grid gap-x-4 gap-y-2 border-t border-line p-3 sm:grid-cols-2">
          {DENOMINATIONS.map((value) => {
            const count = counts[value];
            return (
              <div key={value} className="flex items-center gap-2">
                <label htmlFor={`denom-${value}`} className="num w-[86px] shrink-0 text-[14px] font-semibold">
                  {formatRupiah(value)}
                  <span className="block text-[11px] font-normal text-muted">{isCoin(value) ? t('koin') : t('lembar')}</span>
                </label>
                <span aria-hidden className="text-muted">×</span>
                <input
                  id={`denom-${value}`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={count === undefined ? '' : String(count)}
                  onChange={(e) => setCount(value, e.target.value)}
                  className="num h-11 w-16 rounded-lg border border-line-input bg-surface px-2 text-center text-[15px] font-semibold text-ink outline-none transition-shadow focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/15"
                />
                <span className="num min-w-0 flex-1 truncate text-right text-[13px] text-muted">{count ? formatRupiah(value * count) : ''}</span>
              </div>
            );
          })}
          <p className="num col-span-full flex justify-between border-t border-line pt-2 text-[14px] font-semibold">
            <span>{t('Total dihitung')}</span>
            <span>{formatRupiah(sumDenominations(counts))}</span>
          </p>
        </div>
      )}
    </div>
  );
}

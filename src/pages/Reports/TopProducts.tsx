import { useState } from 'react';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { card } from '../../components/ui/styles';
import { formatRupiah } from '../../lib/money';
import type { ProductRow } from '../../lib/reports';
import { t } from '../../i18n';
import { formatLineQty } from '../../lib/quantity';

const TOP_N = 10;
type Metric = 'revenue' | 'qty';
const METRIC_OPTIONS = [
  { value: 'revenue', label: t('Pendapatan') },
  { value: 'qty', label: t('Qty') },
] as const;

/** Ranked list with thin magnitude bars — a sorted list reads faster than a chart for ≤ 10 names. */
export function TopProducts({ products }: { products: ProductRow[] }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const ranked = [...products].sort((a, b) => b[metric] - a[metric] || b.revenue - a.revenue).slice(0, TOP_N);
  const max = ranked[0]?.[metric] ?? 0;

  return (
    <section className={`${card} p-4 md:p-5`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t('Produk terlaris')}</h2>
          <p className="text-[13px] text-muted">{t('Top')} {TOP_N} {t('· pendapatan sebelum diskon pesanan')}</p>
        </div>
        <SegmentedControl label={t('Urutkan produk')} options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
      </div>
      {ranked.length === 0 ? (
        <p className="text-[14px] text-muted">{t('Belum ada penjualan.')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {ranked.map((p, index) => (
            <li key={p.key} className="grid grid-cols-[20px_1fr_auto] items-center gap-x-3">
              <span className="num text-[13px] font-semibold text-muted">{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{p.name}</span>
                <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-subtle">
                  <span className="block h-full rounded-full bg-brand-600" style={{ width: `${max > 0 ? (p[metric] / max) * 100 : 0}%` }} />
                </span>
              </span>
              <span className="num text-right text-[14px] font-semibold">
                {metric === 'revenue' ? formatRupiah(p.revenue) : formatLineQty(p)}
                <span className="block text-[12px] font-normal text-muted">{metric === 'revenue' ? formatLineQty(p) : formatRupiah(p.revenue)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

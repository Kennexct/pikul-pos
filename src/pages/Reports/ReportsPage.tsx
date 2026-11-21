import { BarChart3, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/Layout/PageHeader';
import { DateRangeControl } from '../../components/ui/DateRangeControl';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { StatTile } from '../../components/ui/StatTile';
import { btnPrimary } from '../../components/ui/styles';
import { useAppData } from '../../hooks/useAppData';
import { useExpenses } from '../../hooks/useCash';
import { useDateRange } from '../../hooks/useDateRange';
import { usePeriodData } from '../../hooks/usePeriodData';
import { getBusinessDate } from '../../lib/businessDate';
import { formatRange } from '../../lib/dateRange';
import type { ExportContext } from '../../lib/export/columns';
import { formatRupiah } from '../../lib/money';
import { buildProfit } from '../../lib/profit';
import { buildReport, type DayRow, type HourRow } from '../../lib/reports';
import { useSessionStore } from '../../store/useSessionStore';
import { BarChartCard, type BarDatum } from './BarChartCard';
import { BreakdownTable } from './BreakdownTable';
import { ExportSheet } from './ExportSheet';
import { ProfitCard } from './ProfitCard';
import { TopProducts } from './TopProducts';
import { DATE_LOCALE, t } from '../../i18n';

const pad = (n: number) => String(n).padStart(2, '0');
const dayLabel = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayDetail = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

const MIN_HOUR_WINDOW = 8;
const LAST_HOUR = 23;

/**
 * Trim to the active hours (±1) so a 10:00–21:00 stall doesn't get a mostly-empty 24-bar chart,
 * but keep at least an 8-hour window so a single busy hour still reads as "peak vs quiet".
 */
function hourData(rows: HourRow[]): BarDatum[] {
  const active = rows.filter((r) => r.transactions > 0).map((r) => r.hour);
  if (active.length === 0) return [];
  let first = Math.max(0, Math.min(...active) - 1);
  let last = Math.min(LAST_HOUR, Math.max(...active) + 1);
  while (last - first + 1 < MIN_HOUR_WINDOW) {
    if (first > 0) first -= 1;
    if (last - first + 1 < MIN_HOUR_WINDOW && last < LAST_HOUR) last += 1;
  }
  return rows.slice(first, last + 1).map((r) => ({
    label: pad(r.hour),
    detail: `${pad(r.hour)}.00–${pad(r.hour)}.59`,
    value: r.gross,
    count: r.transactions,
  }));
}

function dayData(rows: DayRow[]): BarDatum[] {
  return rows.map((r) => {
    const date = new Date(`${r.date}T00:00:00Z`);
    return { label: dayLabel.format(date), detail: dayDetail.format(date), value: r.net, count: r.transactions };
  });
}

/** M12 reports + M13 export entry point. Owner only via <OwnerGate> on the route. Lazy-loaded (ADR-001). */
export default function ReportsPage() {
  const { store } = useAppData();
  const storeId = useSessionStore((s) => s.storeId);
  const today = store ? getBusinessDate(new Date(), store) : new Date().toISOString().slice(0, 10);
  const dateRange = useDateRange(today);
  const data = usePeriodData(storeId, dateRange.range);
  const expenses = useExpenses(storeId, dateRange.range);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const input = useMemo(
    () =>
      store && data
        ? { store, range: dateRange.range, sales: data.sales, refunds: data.refundsInRange, ordersById: data.ordersById, memberName: data.memberName }
        : null,
    [store, data, dateRange.range],
  );
  const report = useMemo(() => (input ? buildReport(input) : null), [input]);
  const profit = useMemo(
    () => (input && report && expenses ? buildProfit({ sales: input.sales, summary: report.summary, expenses }) : null),
    [input, report, expenses],
  );

  if (!store) return <LoadingScreen />;
  const ctx: ExportContext | null = input && profit && expenses ? { input, timeZone: store.timezone, profit, expenses } : null;
  const hours = report ? hourData(report.byHour) : [];
  const isMultiDay = dateRange.range.from !== dateRange.range.to;
  const s = report?.summary;
  const peak = hours.reduce<BarDatum | null>((best, h) => (h.value > (best?.value ?? 0) ? h : best), null);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('Laporan')}
        helpTopic="laporan"
        description={t('{0} · transaksi di perangkat ini', formatRange(dateRange.range))}
        actions={
          <button type="button" aria-label={t('Ekspor laporan')} disabled={!report} onClick={() => setIsExportOpen(true)} className={`${btnPrimary} h-11`}>
            <Download aria-hidden size={18} /> <span className="hidden sm:inline">{t('Ekspor')}</span>
          </button>
        }
      >
        <div className="pb-3">
          <DateRangeControl state={dateRange} today={today} />
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        {!report || !s ? (
          <LoadingScreen />
        ) : s.transactions === 0 && s.refunds === 0 && (expenses ?? []).length === 0 ? (
          <EmptyState icon={BarChart3} title={t('Belum ada penjualan')} description={t('Tidak ada transaksi pada periode ini.')} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3">
              <StatTile label={t('Penjualan bersih')} value={formatRupiah(s.netSales)} hint={t('Kotor {0} − refund {1}', formatRupiah(s.grossSales), formatRupiah(s.refunds))} isPrimary />
              <StatTile label={t('Transaksi')} value={String(s.transactions)} hint={t('{0} item terjual', s.itemsSold)} />
              <StatTile label={t('Rata-rata')} value={formatRupiah(s.averageTicket)} hint={t('per transaksi')} />
              <StatTile label={t('Diskon')} value={formatRupiah(s.discounts)} hint={s.voidCount > 0 ? t('{0} void · {1}', s.voidCount, formatRupiah(s.voidAmount)) : t('Tanpa void')} />
            </div>

            {profit && <ProfitCard profit={profit} />}

            <div className="grid gap-4 xl:grid-cols-2">
              {hours.length > 0 && (
                <BarChartCard
                  title={t('Penjualan per jam')}
                  subtitle={peak ? t('Paling ramai {0} · {1}', peak.detail, formatRupiah(peak.value)) : t('Penjualan kotor')}
                  data={hours}
                  summary={t('Penjualan per jam. {0}', hours.filter((h) => (h.count ?? 0) > 0).map((h) => `${h.detail}: ${formatRupiah(h.value)}`).join('; '))}
                />
              )}
              {isMultiDay && (
                <BarChartCard
                  title={t('Penjualan bersih per hari')}
                  subtitle={t('Sudah dikurangi refund pada hari refund')}
                  data={dayData(report.byDay)}
                  summary={t('Penjualan bersih per hari. {0}', report.byDay.map((d) => `${d.date}: ${formatRupiah(d.net)}`).join('; '))}
                />
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <BreakdownTable title={t('Per metode pembayaran')} description={t('Cocokkan QRIS & transfer dengan mutasi bank')} rows={report.byPaymentMethod} />
              <TopProducts products={report.products} />
              <BreakdownTable title={t('Per mode penjualan')} rows={report.bySalesMode} />
              <BreakdownTable title={t('Per kasir')} rows={report.byCashier} />
            </div>
          </div>
        )}
      </div>

      {isExportOpen && report && ctx && (
        <ExportSheet storeName={store.name} report={report} ctx={ctx} onClose={() => setIsExportOpen(false)} />
      )}
    </section>
  );
}

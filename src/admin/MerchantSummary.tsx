import { useState } from 'react';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { StatTile } from '../components/ui/StatTile';
import { t } from '../i18n';
import { BarChartCard } from '../pages/Reports/BarChartCard';
import { loadMerchantSummary } from './api';
import { daysBefore, fmtDay, fmtDayLong, num, PAY_TYPE_LABEL, rp, todayWib } from './format';
import { LoadError, Section, ShareBars } from './ui';
import { useLoad } from './useLoad';

const RANGES = [
  { value: '7', label: t('7 hari') },
  { value: '30', label: t('30 hari') },
  { value: '90', label: t('90 hari') },
] as const;
type Range = (typeof RANGES)[number]['value'];

/** One merchant's executive summary (ADR-020): totals and mixes only, from the daily totals the app sends. */
export function MerchantSummary({ id, onError }: { id: string; onError: (e: unknown) => Promise<void> }) {
  const [range, setRange] = useState<Range>('30');
  const to = todayWib();
  const from = daysBefore(to, Number(range) - 1);
  const { data, error, reload } = useLoad(() => loadMerchantSummary(id, from, to), [id, from, to], onError);

  return (
    <section aria-label={t('Ringkasan penjualan')} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-ink">{t('Ringkasan penjualan')}</h3>
        <SegmentedControl label={t('Rentang')} options={RANGES} value={range} onChange={setRange} />
      </div>
      {error && !data ? (
        <LoadError error={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingScreen message={t('Memuat…')} />
      ) : data.totals.transactions === 0 && data.totals.refunds === 0 ? (
        <p className="rounded-lg bg-subtle px-3 py-3 text-[14px] text-ink-soft">{t('Belum ada penjualan yang terkirim untuk rentang ini. Ringkasan dikirim aplikasi saat online.')}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile isPrimary label={t('Penjualan bersih')} value={rp(data.totals.net)} hint={t('Kotor {0}', rp(data.totals.gross))} />
            <StatTile label={t('Transaksi')} value={num(data.totals.transactions)} hint={t('Rata-rata {0}', rp(data.totals.averageTicket))} />
            <StatTile label={t('Hari aktif')} value={num(data.activeDays)} hint={t('dari {0} hari', range)} />
            <StatTile label={t('Refund')} value={rp(data.totals.refunds)} hint={t('{0} void', num(data.totals.voidCount))} />
          </div>
          <BarChartCard
            title={t('Penjualan per hari')}
            subtitle={t('Penjualan bersih')}
            data={data.days.map((d) => ({ label: fmtDay(d.date), detail: fmtDayLong(d.date), value: d.net, count: d.transactions }))}
            summary={t('Penjualan bersih per hari, total {0}', rp(data.totals.net))}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Section title={t('Jenis pembayaran')}>
              <ShareBars rows={data.byPay.filter((p) => p.gross > 0).map((p) => ({ label: PAY_TYPE_LABEL[p.type] ?? p.type, value: p.gross - p.refunds, sub: t('{0} transaksi', num(p.transactions)) }))} format={rp} />
            </Section>
            <Section title={t('Mode penjualan')}>
              <ShareBars rows={data.byMode.map((m) => ({ label: m.name, value: m.gross - m.refunds, sub: t('{0} transaksi', num(m.transactions)) }))} format={rp} />
            </Section>
          </div>
          <BarChartCard
            title={t('Jam ramai')}
            subtitle={t('Penjualan kotor per jam')}
            data={data.hours.map((h) => ({ label: String(h.hour).padStart(2, '0'), detail: `${String(h.hour).padStart(2, '0')}.00–${String(h.hour).padStart(2, '0')}.59`, value: h.gross, count: h.transactions }))}
            summary={t('Penjualan per jam')}
          />
          <p className="text-[12px] text-muted">{t('Angka dari ringkasan harian yang dikirim aplikasi merchant (dari satu perangkat per hari, sampai sinkron antar perangkat tersedia).')}</p>
        </>
      )}
    </section>
  );
}

import { Download } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { StatTile } from '../components/ui/StatTile';
import { btnSecondary, card } from '../components/ui/styles';
import { t } from '../i18n';
import { BarChartCard } from '../pages/Reports/BarChartCard';
import { downloadCsv, loadReport, type ExecutiveReport } from './api';
import { errorText } from './errors';
import { daysBefore, fmtDay, fmtDayLong, fmtMonth, num, pct, PAY_TYPE_LABEL, rp, todayWib, WEEKDAYS } from './format';
import { LoadError, PanelHead, Section, ShareBars } from './ui';
import { useLoad } from './useLoad';

const RANGES = [
  { value: '7', label: t('7 hari') },
  { value: '30', label: t('30 hari') },
  { value: '90', label: t('90 hari') },
  { value: '365', label: t('1 tahun') },
] as const;
type Range = (typeof RANGES)[number]['value'];

const BUCKET_LABEL: Record<string, string> = {
  '0': t('Tidak ada transaksi'),
  '1-10': t('1–10 trx/hari'),
  '11-50': t('11–50 trx/hari'),
  '51+': t('Lebih dari 50 trx/hari'),
};

/** Executive report (ADR-020): Pikul's business and all merchants together. Built from payments and the daily totals. */
export function ReportPanel({ onOpenMerchant, onError }: { onOpenMerchant: (id: string) => void; onError: (e: unknown) => Promise<void> }) {
  const [range, setRange] = useState<Range>('30');
  const to = todayWib();
  const from = daysBefore(to, Number(range) - 1);
  const { data, error, reload } = useLoad(() => loadReport(from, to), [from, to], onError);
  const exportCsv = async () => {
    try {
      await downloadCsv(`/api/admin/report?from=${from}&to=${to}&format=csv`, `laporan-merchant-${from}_${to}.csv`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-4">
      <PanelHead
        title={t('Laporan eksekutif')}
        hint={t('{0} – {1}, waktu Indonesia Barat.', fmtDayLong(from), fmtDayLong(to))}
        actions={
          <button type="button" className={btnSecondary} onClick={() => void exportCsv()} disabled={!data}>
            <Download aria-hidden size={18} />
            {t('CSV per merchant')}
          </button>
        }
      />
      <SegmentedControl label={t('Rentang')} options={RANGES} value={range} onChange={setRange} />
      {error && !data ? (
        <LoadError error={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingScreen message={t('Memuat…')} />
      ) : (
        <>
          <Business r={data} />
          <Merchants r={data} onOpenMerchant={onOpenMerchant} />
        </>
      )}
    </div>
  );
}

function Business({ r }: { r: ExecutiveReport }) {
  const b = r.business;
  return (
    <section aria-label={t('Bisnis Pikul')} className="space-y-3">
      <h3 className="text-[15px] font-bold text-ink">{t('Bisnis Pikul')}</h3>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
        <StatTile isPrimary label={t('Pendapatan langganan')} value={rp(b.revenue)} hint={t('{0} pembayaran', num(b.paymentsCount))} />
        <StatTile label={t('Pendaftar baru')} value={num(b.signups)} />
        <StatTile label={t('Berbayar sekarang')} value={num(b.payingNow)} />
        <StatTile label={t('Konversi coba → bayar')} value={pct(b.conversion.converted, b.conversion.eligible)} hint={t('{0} dari {1}', num(b.conversion.converted), num(b.conversion.eligible))} />
        <StatTile label={t('Berhenti langganan')} value={num(b.churned)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <BarChartCard
          title={t('Pendapatan per bulan')}
          data={b.revenueByMonth.map((m) => ({ label: fmtMonth(m.month), detail: fmtMonth(m.month), value: m.total }))}
          summary={t('Pendapatan langganan per bulan')}
        />
        <BarChartCard
          title={t('Pendaftar per minggu')}
          data={b.signupsByWeek.map((w) => ({ label: fmtDay(w.week), detail: t('Minggu mulai {0}', fmtDayLong(w.week)), value: w.count, isCount: true }))}
          summary={t('Pendaftar baru per minggu')}
        />
      </div>
      <p className="text-[12px] text-muted">{t('Konversi dihitung dari pendaftar yang sudah lewat 14 hari masa coba.')}</p>
    </section>
  );
}

function Merchants({ r, onOpenMerchant }: { r: ExecutiveReport; onOpenMerchant: (id: string) => void }) {
  const m = r.merchants;
  const total = m.buckets.reduce((s, b) => s + b.count, 0);
  const maxWeek = Math.max(1, ...m.weekdays.map((w) => (w.days ? w.net / w.days : 0)));
  return (
    <section aria-label={t('Semua merchant')} className="space-y-3">
      <h3 className="text-[15px] font-bold text-ink">{t('Semua merchant')}</h3>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
        <StatTile isPrimary label={t('Penjualan bersih')} value={rp(m.totals.net)} hint={t('Kotor {0}', rp(m.totals.gross))} />
        <StatTile label={t('Transaksi')} value={num(m.totals.transactions)} />
        <StatTile label={t('Rata-rata per struk')} value={rp(m.totals.averageTicket)} />
        <StatTile label={t('Merchant berjualan')} value={num(r.business.activeMerchants)} />
        <StatTile label={t('Refund')} value={rp(m.totals.refunds)} hint={t('{0} void', num(m.totals.voidCount))} />
      </div>
      <BarChartCard
        title={t('Penjualan semua merchant per hari')}
        subtitle={t('Penjualan bersih')}
        data={m.days.map((d) => ({ label: fmtDay(d.date), detail: t('{0} · {1} merchant', fmtDayLong(d.date), num(d.merchants)), value: d.net, count: d.transactions }))}
        summary={t('Penjualan bersih semua merchant per hari, total {0}', rp(m.totals.net))}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Section title={t('Jenis pembayaran')}>
          <ShareBars rows={m.byPay.filter((p) => p.gross > 0).map((p) => ({ label: PAY_TYPE_LABEL[p.type] ?? p.type, value: p.gross - p.refunds, sub: t('{0} transaksi', num(p.transactions)) }))} format={rp} />
        </Section>
        <Section title={t('Mode penjualan')}>
          <ShareBars rows={m.byMode.slice(0, 8).map((x) => ({ label: x.name, value: x.gross - x.refunds, sub: t('{0} transaksi', num(x.transactions)) }))} format={rp} />
        </Section>
        <Section title={t('Hari dalam seminggu')} hint={t('Rata-rata penjualan bersih per hari')}>
          <ul className="space-y-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => {
              const w = m.weekdays[i];
              const avg = w && w.days ? Math.round(w.net / w.days) : 0;
              return (
                <li key={i} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-[13px]">
                  <span className="text-ink-soft">{WEEKDAYS[i]}</span>
                  <span className="h-2 rounded-full bg-subtle">
                    <span className="block h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(0, (avg / maxWeek) * 100)}%` }} />
                  </span>
                  <span className="num text-ink">{rp(avg)}</span>
                </li>
              );
            })}
          </ul>
        </Section>
        <Section title={t('Merchant menurut keramaian')} hint={t('Rata-rata transaksi per hari di rentang ini')}>
          <ShareBars rows={m.buckets.map((b) => ({ label: BUCKET_LABEL[b.key] ?? b.key, value: b.count, sub: pct(b.count, total) }))} format={num} />
        </Section>
      </div>
      <BarChartCard
        title={t('Jam ramai semua merchant')}
        subtitle={t('Penjualan kotor per jam')}
        data={m.hours.map((h) => ({ label: String(h.hour).padStart(2, '0'), detail: `${String(h.hour).padStart(2, '0')}.00–${String(h.hour).padStart(2, '0')}.59`, value: h.gross, count: h.transactions }))}
        summary={t('Penjualan per jam')}
      />
      <Section title={t('10 merchant teratas')} hint={t('Menurut penjualan bersih')}>
        {m.top.length === 0 ? (
          <p className="text-[14px] text-muted">{t('Belum ada penjualan yang terkirim untuk rentang ini.')}</p>
        ) : (
          <ol className={`${card} -mx-1 divide-y divide-line`}>
            {m.top.map((x, i) => (
              <li key={x.accountId}>
                <button type="button" onClick={() => onOpenMerchant(x.accountId)} className="grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-2 px-3 py-2.5 text-left hover:bg-subtle">
                  <span className="num text-[13px] text-muted">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-ink">{x.email}</span>
                    <span className="text-[12px] text-muted">{t('{0} transaksi · {1} dari total', num(x.transactions), pct(x.net, m.totals.net))}</span>
                  </span>
                  <span className="num text-[14px] font-semibold text-ink">{rp(x.net)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <p className="text-[12px] text-muted">{t('Angka penjualan dari ringkasan harian yang dikirim aplikasi merchant saat online. Merchant yang belum online beberapa hari bisa tertinggal.')}</p>
    </section>
  );
}

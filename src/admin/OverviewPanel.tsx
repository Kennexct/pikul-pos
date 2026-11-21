import { Mail, RefreshCw } from 'lucide-react';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { StatTile } from '../components/ui/StatTile';
import { btnGhost, card } from '../components/ui/styles';
import { t } from '../i18n';
import { loadOverview, type FollowUp } from './api';
import { fmtDate, fmtMonth, num, pct, rp, until } from './format';
import { LoadError, PanelHead, Section, StatusChip } from './ui';
import { useLoad } from './useLoad';

const REASON: Record<FollowUp['reason'], string> = {
  trial_ending: t('Masa coba hampir habis'),
  paid_ending: t('Langganan hampir habis'),
  lapsed: t('Baru kedaluwarsa'),
};

interface Props {
  onOpenMerchant: (id: string) => void;
  onError: (e: unknown) => Promise<void>;
}

/** Home: how Pikul is doing today and who to contact (ADR-020). */
export function OverviewPanel({ onOpenMerchant, onError }: Props) {
  const { data, error, busy, reload } = useLoad(loadOverview, [], onError);
  if (error && !data) return <LoadError error={error} onRetry={() => void reload()} />;
  if (!data) return <LoadingScreen message={t('Memuat…')} />;
  const { counts, revenue, sales, conversion } = data;

  return (
    <div className="space-y-5">
      <PanelHead
        title={t('Ringkasan')}
        hint={t('Per {0}', fmtDate(data.now))}
        actions={
          <button type="button" className={btnGhost} onClick={() => void reload()} disabled={busy}>
            <RefreshCw aria-hidden size={18} className={busy ? 'animate-spin' : ''} />
            {t('Muat ulang')}
          </button>
        }
      />
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3">
        <StatTile isPrimary label={t('Uang masuk {0}', fmtMonth(revenue.month))} value={rp(revenue.thisMonth)} hint={t('Bulan lalu {0}', rp(revenue.lastMonth))} />
        <StatTile label={t('Berbayar')} value={num(counts.paid)} hint={t('dari {0} merchant', num(counts.total))} />
        <StatTile label={t('Masa coba')} value={num(counts.trial)} />
        <StatTile label={t('Kedaluwarsa')} value={num(counts.expired)} />
        <StatTile label={t('Daftar 7 hari')} value={num(counts.signups7)} hint={t('30 hari: {0}', num(counts.signups30))} />
        <StatTile label={t('Coba → bayar')} value={pct(conversion.converted, conversion.eligible)} hint={t('{0} dari {1} akun', num(conversion.converted), num(conversion.eligible))} />
        <StatTile label={t('Transaksi hari ini')} value={num(sales.today.transactions)} hint={t('{0} merchant · {1}', num(sales.today.merchants), rp(sales.today.net))} />
        <StatTile label={t('Transaksi 7 hari')} value={num(sales.week.transactions)} hint={t('{0} merchant aktif · {1}', num(sales.week.merchants), rp(sales.week.net))} />
      </div>
      {sales.stopped > 0 && (
        <p className={`${card} px-4 py-3 text-[14px] text-ink-soft`}>
          {t('{0} merchant aktif tidak mencatat penjualan dalam 7 hari terakhir. Lihat filter "Tidak aktif" di tab Merchant.', num(sales.stopped))}
        </p>
      )}
      <Section title={t('Perlu dihubungi')} hint={t('Masa coba habis ≤ 3 hari, langganan habis ≤ 7 hari, atau baru kedaluwarsa.')}>
        {data.followUps.length === 0 ? (
          <p className="text-[14px] text-muted">{t('Tidak ada yang perlu dihubungi hari ini.')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.followUps.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <button type="button" onClick={() => onOpenMerchant(f.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-semibold text-ink underline-offset-2 hover:underline">{f.email}</span>
                  <span className="text-[13px] text-muted">
                    {REASON[f.reason]} · {until(f.until, data.now)}
                  </span>
                </button>
                <StatusChip status={f.status} />
                <a className={btnGhost} href={`mailto:${f.email}`} aria-label={t('Kirim email ke {0}', f.email)}>
                  <Mail aria-hidden size={18} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

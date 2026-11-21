import { ChevronLeft, ChevronRight, Download, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { SearchInput } from '../components/ui/SearchInput';
import { btnIcon, btnSecondary, card, option } from '../components/ui/styles';
import { t } from '../i18n';
import { downloadCsv, loadMerchants, merchantsCsvPath, type PlanCount } from './api';
import { errorText } from './errors';
import { ago, fmtDate, num, rp, until } from './format';
import { fmtPhone } from './MerchantProfile';
import { MerchantSheet } from './MerchantSheet';
import { LoadError, PanelHead, StatusChip } from './ui';
import { useLoad } from './useLoad';

const FILTERS = [
  { value: 'all', label: t('Semua') },
  { value: 'trial', label: t('Coba') },
  { value: 'paid', label: t('Berbayar') },
  { value: 'ending', label: t('Hampir habis') },
  { value: 'expired', label: t('Kedaluwarsa') },
  { value: 'inactive', label: t('Tidak aktif') },
] as const;

const planLabel = (p: PlanCount) => (p.key === 'trial' ? t('Masa coba') : p.key === 'expired' ? t('Kedaluwarsa') : p.key === 'paid' ? t('Berbayar tanpa paket') : (p.label ?? p.key));

interface Props {
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  onError: (e: unknown) => Promise<void>;
}

/** Merchant list (ADR-020, ADR-023): sign-up details, plan counts, status filters, search, CSV. Opening one shows its summary only. */
export function MerchantsPanel({ openId, onOpenChange, onError }: Props) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);
  const { data, error, reload } = useLoad(() => loadMerchants({ q: query, filter, plan, page }), [query, filter, plan, page], onError);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const exportCsv = async () => {
    try {
      await downloadCsv(merchantsCsvPath({ q: query, filter, plan }), 'merchant-pikul.csv');
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <div className="space-y-4">
      <PanelHead
        title={t('Merchant')}
        hint={t('Data pendaftaran dan ringkasan. Konsol tidak bisa membuka struk atau menu merchant.')}
        actions={
          <button type="button" className={btnSecondary} onClick={() => void exportCsv()} disabled={!data || data.total === 0}>
            <Download aria-hidden size={18} />
            {t('Unduh CSV')}
          </button>
        }
      />
      {data && (
        <section aria-label={t('Paket merchant')} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {data.plans.map((p) => {
            const active = plan === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPlan(active ? '' : p.key);
                  setFilter('all');
                  setPage(0);
                }}
                className={`${card} px-3 py-2.5 text-left transition-colors ${active ? 'border-brand-600 ring-1 ring-inset ring-brand-600' : 'hover:bg-subtle'}`}
              >
                <span className="block truncate text-[13px] font-medium text-muted">{planLabel(p)}</span>
                <span className="num block text-[20px] font-bold text-ink">{num(p.count)}</span>
              </button>
            );
          })}
        </section>
      )}
      <SearchInput value={q} onChange={setQ} placeholder={t('Cari toko, pemilik, email, WhatsApp, kota')} label={t('Cari merchant')} />
      <div className="scroll-x -mx-1 flex gap-2 px-1" role="group" aria-label={t('Saring status')}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            className={`${option(filter === f.value)} shrink-0`}
            onClick={() => {
              setFilter(f.value);
              setPlan('');
              setPage(0);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && !data ? (
        <LoadError error={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingScreen message={t('Memuat…')} />
      ) : data.rows.length === 0 ? (
        <EmptyState icon={Users} title={t('Tidak ada merchant')} description={query || filter !== 'all' || plan ? t('Coba ubah pencarian atau saringan.') : t('Merchant muncul di sini setelah mendaftar di aplikasi.')} />
      ) : (
        <>
          <p className="num text-[13px] text-muted">{t('{0} merchant', num(data.total))}</p>
          <ul className={`${card} divide-y divide-line`}>
            {data.rows.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onOpenChange(m.id)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-subtle md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto] md:items-center">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">{m.storeName || m.email}</span>
                    <span className="block truncate text-[13px] text-ink-soft">{[m.ownerName, m.storeName ? m.email : '', m.phone ? fmtPhone(m.phone) : '', m.city].filter(Boolean).join(' · ')}</span>
                    <span className="text-[13px] text-muted">{t('Daftar {0}', fmtDate(m.createdAt))}</span>
                  </span>
                  <span className="justify-self-end md:order-last">
                    <StatusChip status={m.status} />
                  </span>
                  <span className="text-[13px] text-ink-soft md:text-[14px]">
                    {m.planName ?? (m.status === 'trial' ? t('Masa coba') : '–')} · {m.status === 'expired' ? t('Habis {0}', fmtDate(m.until)) : until(m.until, data.now)}
                  </span>
                  <span className="num justify-self-end text-[13px] text-ink-soft md:justify-self-start md:text-[14px]">
                    {t('{0} trx 30 hr', num(m.tx30))} · {rp(m.net30)}
                  </span>
                  <span className={`text-[13px] md:text-[14px] ${m.inactive ? 'text-warn-700' : 'text-muted'}`}>{t('Aktif {0}', ago(m.lastSeenAt, data.now).toLowerCase())}</span>
                </button>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" className={btnIcon} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label={t('Halaman sebelumnya')}>
                <ChevronLeft aria-hidden size={18} />
              </button>
              <span className="num text-[14px] text-ink-soft">{t('Halaman {0} dari {1}', page + 1, pages)}</span>
              <button type="button" className={btnIcon} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label={t('Halaman berikutnya')}>
                <ChevronRight aria-hidden size={18} />
              </button>
            </div>
          )}
        </>
      )}
      {openId && <MerchantSheet id={openId} onClose={() => onOpenChange(null)} onChanged={() => void reload()} onError={onError} />}
    </div>
  );
}

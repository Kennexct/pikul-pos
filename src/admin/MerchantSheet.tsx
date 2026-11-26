import { CalendarPlus, Wallet } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { Sheet } from '../components/ui/Sheet';
import { btnDanger, btnPrimary, btnSecondary, card, inputBase, labelBase } from '../components/ui/styles';
import { t } from '../i18n';
import { cancelPayment, loadMerchant, type MerchantDetail, type Payment } from './api';
import { errorText, isAuthError } from './errors';
import { ago, fmtDate, fmtDateTime, METHOD_LABEL, rp, until } from './format';
import { GrantForm, PaymentForm } from './MerchantActions';
import { MerchantProfile } from './MerchantProfile';
import { MerchantSummary } from './MerchantSummary';
import { LoadError, StatusChip } from './ui';
import { useLoad } from './useLoad';

type View = 'detail' | 'pay' | 'grant';

interface Props {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onError: (e: unknown) => Promise<void>;
}

/** One merchant (ADR-020): account facts, payment ledger, free days and the sales summary. Never the merchant's own data. */
export function MerchantSheet({ id, onClose, onChanged, onError }: Props) {
  const [view, setView] = useState<View>('detail');
  const { data, error, reload } = useLoad(() => loadMerchant(id), [id], onError);
  const done = () => {
    setView('detail');
    void reload();
    onChanged();
  };
  const title = view === 'pay' ? t('Catat pembayaran') : view === 'grant' ? t('Tambah hari coba') : t('Detail merchant');

  return (
    <Sheet isOpen title={title} subtitle={data ? data.merchant.storeName || data.merchant.email : undefined} onClose={view === 'detail' ? onClose : () => setView('detail')} isWide>
      {error && !data ? (
        <LoadError error={error} onRetry={() => void reload()} />
      ) : !data ? (
        <LoadingScreen message={t('Memuat…')} />
      ) : view === 'pay' ? (
        <PaymentForm detail={data} onDone={done} onCancel={() => setView('detail')} onError={onError} />
      ) : view === 'grant' ? (
        <GrantForm detail={data} onDone={done} onCancel={() => setView('detail')} onError={onError} />
      ) : (
        <Detail data={data} onPay={() => setView('pay')} onGrant={() => setView('grant')} onChanged={done} onError={onError} />
      )}
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-medium text-muted">{label}</dt>
      <dd className="truncate text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Detail({ data, onPay, onGrant, onChanged, onError }: { data: MerchantDetail; onPay: () => void; onGrant: () => void; onChanged: () => void; onError: (e: unknown) => Promise<void> }) {
  const m = data.merchant;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <StatusChip status={m.status} />
        <span className="text-[14px] text-ink-soft">{m.status === 'expired' ? t('Habis {0}', fmtDate(m.until)) : until(m.until, data.now)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact label={t('Paket')} value={m.planName ?? (m.status === 'trial' ? t('Masa coba') : '–')} />
        <Fact label={t('Daftar')} value={fmtDate(m.createdAt)} />
        <Fact label={t('Terakhir aktif')} value={ago(m.lastSeenAt, data.now)} />
        <Fact label={t('Total dibayar')} value={rp(m.totalPaid)} />
      </dl>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className={btnPrimary} onClick={onPay}>
          <Wallet aria-hidden size={18} />
          {t('Catat pembayaran')}
        </button>
        <button type="button" className={btnSecondary} onClick={onGrant}>
          <CalendarPlus aria-hidden size={18} />
          {t('Tambah hari coba')}
        </button>
      </div>
      <MerchantProfile m={m} onError={onError} />
      <MerchantSummary id={m.id} onError={onError} />
      <section aria-label={t('Riwayat pembayaran')}>
        <h3 className="mb-2 text-[15px] font-semibold text-ink">{t('Riwayat pembayaran')}</h3>
        {data.payments.length === 0 ? (
          <p className="text-[14px] text-muted">{t('Belum ada pembayaran.')}</p>
        ) : (
          <ul className={`${card} divide-y divide-line`}>
            {data.payments.map((p) => (
              <PaymentItem key={p.id} p={p} onChanged={onChanged} onError={onError} />
            ))}
          </ul>
        )}
      </section>
      {data.grants.length > 0 && (
        <section aria-label={t('Hari coba tambahan')}>
          <h3 className="mb-2 text-[15px] font-semibold text-ink">{t('Hari coba tambahan')}</h3>
          <ul className={`${card} divide-y divide-line`}>
            {data.grants.map((g) => (
              <li key={g.id} className="px-4 py-3 text-[14px]">
                <span className="font-semibold text-ink">{t('+{0} hari', g.days)}</span> <span className="text-ink-soft">· {g.reason}</span>
                <span className="block text-[13px] text-muted">{t('{0} · sampai {1}', fmtDateTime(g.at), fmtDate(g.newTrialEndsAt))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PaymentItem({ p, onChanged, onError }: { p: Payment; onChanged: () => void; onError: (e: unknown) => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      await cancelPayment(p.id, reason.trim());
      toast.success(t('Pembayaran dibatalkan.'));
      onChanged();
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const isCancelled = p.cancelledAt !== null;
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`num text-[15px] font-semibold ${isCancelled ? 'text-muted line-through' : 'text-ink'}`}>
            {rp(p.amount)} · {t('{0} hari', p.days)}
          </p>
          <p className="text-[13px] text-muted">
            {fmtDate(Date.parse(`${p.paidOn}T00:00:00+07:00`))} · {METHOD_LABEL[p.method]}
            {p.reference ? ` · ${p.reference}` : ''}
          </p>
          {isCancelled ? (
            <p className="text-[13px] text-danger-700">{t('Dibatalkan: {0}', p.cancelReason ?? '')}</p>
          ) : (
            <p className="text-[13px] text-ink-soft">{t('Aktif {0} – {1}', fmtDate(p.startsAt), fmtDate(p.endsAt))}</p>
          )}
        </div>
        {!isCancelled && !asking && (
          <button type="button" className="h-11 shrink-0 rounded-lg px-3 text-[14px] font-semibold text-danger-700 hover:bg-danger-50" onClick={() => setAsking(true)}>
            {t('Batalkan')}
          </button>
        )}
      </div>
      {asking && (
        <div className="mt-3 space-y-2">
          <label className={labelBase} htmlFor={`cancel-${p.id}`}>
            {t('Alasan pembatalan')}
          </label>
          <input id={`cancel-${p.id}`} className={inputBase} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Contoh: salah catat, transfer gagal')} />
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={() => setAsking(false)}>
              {t('Kembali')}
            </button>
            <button type="button" className={btnDanger} disabled={!reason.trim() || busy} onClick={() => void cancel()}>
              {t('Batalkan pembayaran')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

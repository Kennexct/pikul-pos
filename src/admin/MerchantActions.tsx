import { useState } from 'react';
import toast from 'react-hot-toast';
import { RupiahInput } from '../components/ui/RupiahInput';
import { btnPrimary, btnSecondary, helperText, inputBase, labelBase, option } from '../components/ui/styles';
import { t } from '../i18n';
import { grantTrial, recordPayment, type MerchantDetail, type Payment } from './api';
import { errorText, isAuthError } from './errors';
import { fmtDate, METHOD_LABEL, rp } from './format';

const DAY = 86_400_000;
const METHODS = Object.keys(METHOD_LABEL) as Payment['method'][];

interface Props {
  detail: MerchantDetail;
  onDone: () => void;
  onCancel: () => void;
  onError: (e: unknown) => Promise<void>;
}

/** Catat pembayaran (ADR-020): plan fills today's price and days; the account is extended from its current end. */
export function PaymentForm({ detail, onDone, onCancel, onError }: Props) {
  const m = detail.merchant;
  const first = detail.offers[0];
  const [planId, setPlanId] = useState(first?.id ?? '');
  const [amount, setAmount] = useState<number | null>(first?.amount ?? null);
  const [days, setDays] = useState(String(first?.days ?? 30));
  const [method, setMethod] = useState<Payment['method']>('transfer');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(detail.today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (id: string) => {
    setPlanId(id);
    const o = detail.offers.find((x) => x.id === id);
    if (o) {
      setAmount(o.amount);
      setDays(String(o.days));
    }
  };
  const n = Number(days);
  const base = Math.max(detail.now, m.trialEndsAt, m.paidUntil ?? 0);
  const valid = amount !== null && Number.isInteger(n) && n >= 1 && n <= 1095;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await recordPayment(m.id, { planId: planId || null, amount: amount ?? 0, days: n, method, reference, paidOn, note });
      toast.success(t('Pembayaran dicatat. Aktif sampai {0}.', fmtDate(base + n * DAY)));
      onDone();
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className={labelBase}>{t('Paket')}</p>
        <div className="flex flex-wrap gap-2">
          {detail.offers.map((o) => (
            <button key={o.id} type="button" className={option(planId === o.id)} aria-pressed={planId === o.id} onClick={() => pick(o.id)}>
              {o.name} · {rp(o.amount)}
            </button>
          ))}
          <button type="button" className={option(planId === '')} aria-pressed={planId === ''} onClick={() => setPlanId('')}>
            {t('Tanpa paket')}
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelBase} htmlFor="pay-amount">
            {t('Jumlah dibayar')}
          </label>
          <RupiahInput id="pay-amount" value={amount} onChange={setAmount} />
        </div>
        <div>
          <label className={labelBase} htmlFor="pay-days">
            {t('Masa aktif (hari)')}
          </label>
          <input id="pay-days" inputMode="numeric" className={inputBase} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
      </div>
      <div>
        <p className={labelBase}>{t('Metode')}</p>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((k) => (
            <button key={k} type="button" className={option(method === k)} aria-pressed={method === k} onClick={() => setMethod(k)}>
              {METHOD_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelBase} htmlFor="pay-ref">
            {t('Referensi (opsional)')}
          </label>
          <input id="pay-ref" className={inputBase} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('No. transfer / ID QRIS')} />
        </div>
        <div>
          <label className={labelBase} htmlFor="pay-date">
            {t('Tanggal bayar')}
          </label>
          <input id="pay-date" type="date" className={inputBase} value={paidOn} max={detail.today} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelBase} htmlFor="pay-note">
          {t('Catatan (opsional)')}
        </label>
        <input id="pay-note" className={inputBase} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {valid && (
        <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-[14px] text-brand-800">
          {t('Aktif dari {0} sampai {1}.', fmtDate(base), fmtDate(base + n * DAY))} {base > detail.now && t('Sisa masa coba/langganan tidak hilang.')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[14px] text-danger-700">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btnSecondary} onClick={onCancel}>
          {t('Batal')}
        </button>
        <button type="button" className={btnPrimary} onClick={() => void save()} disabled={!valid || busy}>
          {busy ? t('Menyimpan…') : t('Catat pembayaran')}
        </button>
      </div>
    </div>
  );
}

/** Tambah hari coba: free days with a reason (ADR-020). */
export function GrantForm({ detail, onDone, onCancel, onError }: Props) {
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 60 && reason.trim().length > 0;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await grantTrial(detail.merchant.id, n, reason.trim());
      toast.success(t('{0} hari coba ditambahkan.', n));
      onDone();
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <label className={labelBase} htmlFor="grant-days">
          {t('Tambah hari (1–60)')}
        </label>
        <input id="grant-days" inputMode="numeric" className={inputBase} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        <p className={helperText}>{t('Masa coba sekarang sampai {0}.', fmtDate(detail.merchant.trialEndsAt))}</p>
      </div>
      <div>
        <label className={labelBase} htmlFor="grant-reason">
          {t('Alasan')}
        </label>
        <input id="grant-reason" className={inputBase} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Contoh: promo pameran UMKM')} />
      </div>
      {error && (
        <p role="alert" className="text-[14px] text-danger-700">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btnSecondary} onClick={onCancel}>
          {t('Batal')}
        </button>
        <button type="button" className={btnPrimary} onClick={() => void save()} disabled={!valid || busy}>
          {t('Tambah hari coba')}
        </button>
      </div>
    </div>
  );
}

import { KeyRound, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { btnSecondary, card } from '../components/ui/styles';
import { t } from '../i18n';
import { tempPassword, type AccountView } from './api';
import { errorText, isAuthError } from './errors';

/** 6281234567890 → +62 812-3456-7890 (display only). */
export const fmtPhone = (p: string) => (p ? `+62 ${p.slice(2).replace(/^(\d{3})(\d{4})(\d+)$/, '$1-$2-$3')}` : '–');

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-4 py-2.5 text-[14px]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-ink">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
            {value}
          </a>
        ) : (
          value || '–'
        )}
      </dd>
    </div>
  );
}

/** Shop profile: the latest name, WhatsApp and address the merchant saved in the app (else what they typed at sign-up, ADR-023), plus a one-time temporary password. */
export function MerchantProfile({ m, onError }: { m: AccountView; onError: (e: unknown) => Promise<void> }) {
  const [password, setPassword] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const wa = m.phone ? `https://wa.me/${m.phone}` : undefined;

  const make = async () => {
    setBusy(true);
    try {
      setPassword((await tempPassword(m.id)).password);
      setAsking(false);
    } catch (e) {
      if (isAuthError(e)) await onError(e);
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t('Profil toko')} className="space-y-3">
      <h3 className="text-[15px] font-bold text-ink">{t('Profil toko')}</h3>
      <dl className={`${card} divide-y divide-line`}>
        <Row label={t('Nama toko')} value={m.storeName} />
        <Row label={t('Pemilik')} value={m.ownerName} />
        <Row label={t('Email')} value={m.email} href={`mailto:${m.email}`} />
        <Row label={t('WhatsApp')} value={fmtPhone(m.phone)} href={wa} />
        <Row label={t('Alamat')} value={m.address} />
        <Row label={t('Kota')} value={m.city} />
      </dl>
      {password ? (
        <div role="status" className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-[14px] text-ink">
          <p>{t('Kata sandi sementara (hanya tampil sekali). Kirim ke merchant, lalu minta ia menggantinya di Pengaturan.')}</p>
          <p className="num mt-2 select-all text-[20px] font-bold tracking-[0.06em]">{password}</p>
          {wa && (
            <a className={`${btnSecondary} mt-3`} href={`${wa}?text=${encodeURIComponent(t('Kata sandi sementara Pikul Anda: {0}', password))}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden size={18} />
              {t('Kirim lewat WhatsApp')}
            </a>
          )}
        </div>
      ) : asking ? (
        <div className="space-y-2 rounded-lg border border-line px-4 py-3">
          <p className="text-[14px] text-ink-soft">{t('Kata sandi lama berhenti berlaku dan semua perangkat merchant harus masuk lagi. Lanjutkan?')}</p>
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={() => setAsking(false)}>
              {t('Kembali')}
            </button>
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void make()}>
              {busy ? t('Membuat…') : t('Ya, buat sekarang')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={btnSecondary} onClick={() => setAsking(true)}>
          <KeyRound aria-hidden size={18} />
          {t('Buat kata sandi sementara')}
        </button>
      )}
    </section>
  );
}

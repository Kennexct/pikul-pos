import { CloudDownload, CloudOff, Smartphone, Store as StoreIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Logo } from '../../components/Brand/Logo';
import { btnPrimary, btnSecondary, card, helperText, labelBase } from '../../components/ui/styles';
import { ApiError } from '../../services/account';
import type { StoreFacts } from '../../services/syncBinding';
import { PasswordInput } from '../Auth/PasswordInput';
import { t } from '../../i18n';

/** Screens between sign-in and the cashier while the device gets its store (ADR-025, spec §3). */

function Frame({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-6 text-ink md:justify-center md:py-10">
      <div className="mb-5">
        <Logo size={34} />
      </div>
      <section className="w-full max-w-[560px] rounded-xl border border-line bg-surface p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            {icon}
          </span>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
        </div>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </section>
    </main>
  );
}

const lastSale = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : t('belum ada');

function Facts({ facts }: { facts: StoreFacts }) {
  return (
    <ul className="mt-1 text-[14px] text-ink-soft">
      <li className="num">{t('{0} produk', facts.products)}</li>
      <li className="num">{t('{0} penjualan', facts.orders)}</li>
      <li>{t('Penjualan terakhir: {0}', lastSale(facts.lastSaleAt))}</li>
    </ul>
  );
}

export function DownloadingScreen({ received }: { received: number }) {
  return (
    <Frame icon={<CloudDownload size={22} />} title={t('Mengunduh data toko…')}>
      <p className="text-[15px]">{t('Menu, staf, pelanggan dan penjualan dari akun Anda sedang disiapkan di perangkat ini.')}</p>
      <p role="status" className="num text-[14px] text-muted">
        {t('{0} data diterima', received)}
      </p>
      <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-600" />
      </div>
    </Frame>
  );
}

export function NeedOnlineScreen({ message, onRetry, onNewStore }: { message?: string; onRetry: () => void; onNewStore: () => void }) {
  return (
    <Frame icon={<CloudOff size={22} />} title={message ? t('Toko belum siap') : t('Perlu internet')}>
      <p className="text-[15px]">{message ?? t('Perlu internet untuk mengunduh toko dari akun Anda. Sambungkan internet, lalu coba lagi.')}</p>
      <button type="button" onClick={onRetry} className={btnPrimary}>
        {t('Coba lagi')}
      </button>
      <button type="button" onClick={onNewStore} className={btnSecondary}>
        {t('Buat toko baru saja')}
      </button>
    </Frame>
  );
}

interface ChoiceProps {
  local: StoreFacts;
  remote: StoreFacts;
  onAccount: () => Promise<void>;
  onDevice: (password: string) => Promise<void>;
}

/** "Toko mana yang dipakai?" — the store not kept is always saved as a backup file first (Kenny's choice). */
export function StoreChoiceScreen({ local, remote, onAccount, onDevice }: ChoiceProps) {
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      const wrong = error instanceof ApiError && error.code === 'wrong_password';
      toast.error(wrong ? t('Kata sandi salah.') : error instanceof Error ? error.message : t('Gagal. Coba lagi.'));
      setBusy(false);
    }
  };
  const recommendAccount = remote.orders >= local.orders;

  return (
    <Frame icon={<StoreIcon size={22} />} title={t('Toko mana yang dipakai di perangkat ini?')}>
      <p className="text-[15px]">{t('Akun Anda sudah punya toko, dan perangkat ini juga punya toko lain. Pilih satu. Toko yang tidak dipakai disimpan dulu sebagai berkas cadangan.')}</p>
      <div className={`${card} p-4`}>
        <p className="text-[13px] font-semibold text-muted">{t('Toko dari akun')}</p>
        <p className="mt-1 text-[17px] font-semibold">{remote.name || t('Toko')}</p>
        <Facts facts={remote} />
        <button type="button" disabled={busy} onClick={() => void run(onAccount)} className={`${recommendAccount ? btnPrimary : btnSecondary} mt-3 w-full`}>
          {t('Pakai toko dari akun')}
        </button>
        <p className={helperText}>{t('Toko di perangkat ini disimpan sebagai berkas cadangan, lalu dihapus dari perangkat ini.')}</p>
      </div>
      <div className={`${card} p-4`}>
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <Smartphone aria-hidden size={14} /> {t('Toko di perangkat ini')}
        </p>
        <p className="mt-1 text-[17px] font-semibold">{local.name || t('Toko')}</p>
        <Facts facts={local} />
        {!askPassword ? (
          <button type="button" disabled={busy} onClick={() => setAskPassword(true)} className={`${recommendAccount ? btnSecondary : btnPrimary} mt-3 w-full`}>
            {t('Pakai toko di perangkat ini')}
          </button>
        ) : (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => onDevice(password));
            }}
          >
            <label htmlFor="replace-password" className={labelBase}>
              {t('Kata sandi akun')}
            </label>
            <PasswordInput id="replace-password" value={password} onChange={setPassword} autoComplete="current-password" />
            <button type="submit" disabled={busy || password.length === 0} className={btnPrimary}>
              {t('Ganti toko di akun')}
            </button>
          </form>
        )}
        <p className={helperText}>{t('Toko di akun disimpan sebagai berkas cadangan, lalu diganti dengan toko ini di semua perangkat.')}</p>
      </div>
    </Frame>
  );
}

export function OtherAccountScreen({ local, onContinue }: { local: StoreFacts; onContinue: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Frame icon={<StoreIcon size={22} />} title={t('Toko di perangkat ini milik akun lain')}>
      <p className="text-[15px]">{t('Data "{0}" disimpan sebagai berkas cadangan, lalu dihapus dari perangkat ini. Setelah itu toko dari akun Anda dipakai.', local.name || t('Toko'))}</p>
      <Facts facts={local} />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onContinue().catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : t('Gagal. Coba lagi.'));
            setBusy(false);
          });
        }}
        className={btnPrimary}
      >
        {t('Simpan cadangan dan lanjutkan')}
      </button>
    </Frame>
  );
}

import { ArrowLeft, Banknote, Landmark, QrCode, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Logo } from '../../components/Brand/Logo';
import { IntroCards } from '../../components/Help/IntroCards';
import { LanguagePicker } from '../../components/LanguagePicker';
import { Switch } from '../../components/ui/Switch';
import { btnGhost, btnPrimary, btnSecondary, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { compressQrisImage } from '../../lib/image';
import { DEFAULT_SETUP, STORE_NAME_MAX, type StoreSetup } from '../../services/storeSetup';
import { t } from '../../i18n';

/** The first title is shown in both languages: the reader has not chosen one yet. */
const STEP_TITLES = ['Bahasa / Language', t('Toko Anda'), t('Cara pembayaran'), t('Cara kerja Pikul')] as const;
const LAST_STEP = STEP_TITLES.length - 1;

interface OnboardingPageProps {
  /** Creates the store and enters the app. Without a setup: an empty store with the default name ("Lewati"). */
  onComplete: (setup?: StoreSetup) => Promise<void>;
}

/** First-time journey (ADR-009): shown only when this device has no store yet. Language, then three short steps; no account. */
export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [setup, setSetup] = useState<StoreSetup>({ ...DEFAULT_SETUP, storeName: '' });
  const [isBusy, setIsBusy] = useState(false);
  const update = (patch: Partial<StoreSetup>) => setSetup((current) => ({ ...current, ...patch }));

  const finish = async (chosen?: StoreSetup) => {
    setIsBusy(true);
    try {
      await onComplete(chosen);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyiapkan toko.'));
      setIsBusy(false);
    }
  };

  const pickQris = async (file: File | undefined) => {
    if (!file) return;
    const result = await compressQrisImage(file);
    if (result.ok) update({ qrisImageUrl: result.value });
    else toast.error(result.error);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-6 text-ink md:justify-center md:py-10">
      <div className="mb-5">
        <Logo size={34} />
      </div>
      <div className="w-full max-w-[560px] rounded-xl border border-line bg-surface shadow-xs">
        <header className="border-b border-line px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" aria-label={t('Kembali')} onClick={() => setStep(step - 1)} className="-ml-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-subtle">
                <ArrowLeft aria-hidden size={19} />
              </button>
            )}
            <p className="num text-[13px] font-semibold text-muted">{t('Langkah')} {step + 1} {t('dari')} {STEP_TITLES.length}</p>
          </div>
          <div aria-hidden className="mt-2.5 flex gap-1.5">
            {STEP_TITLES.map((title, index) => (
              <span key={title} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-brand-600' : 'bg-subtle'}`} />
            ))}
          </div>
          <h1 className="mt-4 text-[22px] font-bold tracking-[-0.02em]">{STEP_TITLES[step]}</h1>
        </header>

        <div className="px-5 py-5">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <LanguagePicker />
              <p className={helperText}>{t('Bisa diganti kapan saja di Pengaturan.')}</p>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <label htmlFor="store-name" className={labelBase}>{t('Nama toko')}</label>
                <input id="store-name" autoFocus value={setup.storeName} maxLength={STORE_NAME_MAX} placeholder={t('mis. Bakso Pak Kumis')} onChange={(e) => update({ storeName: e.target.value })} className={inputBase} />
                <p className={helperText}>{t('Tampil di struk. Bisa diubah nanti.')}</p>
              </div>
              <p className={helperText}>{t('Menu masih kosong. Setelah ini, tambahkan produk yang Anda jual beserta harganya.')}</p>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 py-2">
                <Banknote aria-hidden size={22} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1"><Switch checked disabled onChange={() => undefined} label={t('Tunai')} description={t('Selalu tersedia, dengan hitung kembalian.')} /></div>
              </div>
              <div className="flex items-start gap-3 border-t border-line py-2">
                <QrCode aria-hidden size={22} className="mt-2.5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <Switch checked={setup.hasQris} onChange={(hasQris) => update({ hasQris })} label={t('QRIS')} description={t('Tampilkan kode QRIS toko ke pelanggan.')} />
                  {setup.hasQris && (
                    <div className="mb-2 mt-1 flex items-center gap-3">
                      {setup.qrisImageUrl && <img src={setup.qrisImageUrl} alt={t('Gambar QRIS toko')} className="h-14 w-14 rounded-md border border-line object-cover" />}
                      <input ref={fileInput} type="file" accept="image/*" aria-label={t('Gambar QRIS')} className="sr-only" onChange={(e) => void pickQris(e.target.files?.[0])} />
                      <button type="button" onClick={() => fileInput.current?.click()} className={`${btnSecondary} h-10 text-[14px]`}>
                        <Upload aria-hidden size={16} /> {setup.qrisImageUrl ? t('Ganti gambar') : t('Unggah gambar QRIS')}
                      </button>
                      {!setup.qrisImageUrl && <span className="text-[13px] text-muted">{t('Boleh nanti.')}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-line py-2">
                <Landmark aria-hidden size={22} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1"><Switch checked={setup.hasTransfer} onChange={(hasTransfer) => update({ hasTransfer })} label={t('Transfer bank')} description={t('Catat pembayaran lewat transfer.')} /></div>
              </div>
              <p className={helperText}>{t('E-wallet dan cara bayar lain bisa ditambah di Pengaturan.')}</p>
            </div>
          )}

          {step === LAST_STEP && <IntroCards />}
        </div>

        <footer className="flex flex-col gap-2 border-t border-line px-5 py-4">
          {step < LAST_STEP ? (
            <button type="button" onClick={() => setStep(step + 1)} className={`${btnPrimary} w-full`}>{t('Lanjut')}</button>
          ) : (
            <button type="button" disabled={isBusy} onClick={() => void finish(setup)} className={`${btnPrimary} w-full`}>{t('Mulai jualan')}</button>
          )}
          {step <= 1 && (
            <button type="button" disabled={isBusy} onClick={() => void finish()} className={`${btnGhost} w-full text-[14px]`}>{t('Lewati')}</button>
          )}
        </footer>
      </div>
      <p className="mt-4 max-w-[560px] text-center text-[13px] text-muted">{t('Tanpa akun dan tanpa internet. Data toko tersimpan di perangkat ini.')}</p>
    </main>
  );
}

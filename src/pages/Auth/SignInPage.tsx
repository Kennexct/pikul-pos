import { ArrowLeft, Mail } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Logo } from '../../components/Brand/Logo';
import { LanguagePicker } from '../../components/LanguagePicker';
import { btnGhost, btnPrimary, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { ApiError, GOOGLE_CLIENT_ID, googleSignIn, requestCode, verifyCode } from '../../services/account';
import { useAccessStore } from '../../store/useAccessStore';
import { t } from '../../i18n';

const ERRORS: Record<string, string> = {
  invalid_email: t('Alamat email tidak valid.'),
  too_soon: t('Tunggu 1 menit sebelum meminta kode baru.'),
  invalid_code: t('Kode salah. Periksa lagi email Anda.'),
  code_expired: t('Kode sudah kedaluwarsa. Minta kode baru.'),
  too_many_attempts: t('Terlalu banyak percobaan. Minta kode baru.'),
  invalid_token: t('Masuk dengan Google gagal. Coba lagi.'),
  offline: t('Tidak ada internet. Masuk pertama kali butuh koneksi; setelah itu kasir bisa dipakai offline.'),
};
const message = (e: unknown) => (e instanceof ApiError ? (ERRORS[e.code] ?? t('Terjadi kesalahan di server. Coba lagi sebentar.')) : t('Terjadi kesalahan di server. Coba lagi sebentar.'));

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } };
  }
}

function GoogleButton({ onError }: { onError: (m: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const setClaims = useAccessStore((s) => s.setClaims);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !navigator.onLine) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google || !el.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }: { credential: string }) => {
          try {
            setClaims(await googleSignIn(credential));
          } catch (e) {
            onError(message(e));
          }
        },
      });
      window.google.accounts.id.renderButton(el.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [setClaims, onError]);
  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <>
      <div ref={el} className="flex min-h-11 justify-center" />
      <div className="my-5 flex items-center gap-3 text-[13px] text-muted">
        <span className="h-px flex-1 bg-line" />
        {t('atau dengan email')}
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

/** ADR-013: sign in (or sign up — same flow) before the POS. The first sign-in starts the 14-day trial. */
export function SignInPage() {
  const setClaims = useAccessStore((s) => s.setClaims);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestCode(email);
      setStep('code');
      setCode('');
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setClaims(await verifyCode(email, code));
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-8 text-ink md:justify-center">
      <a href="/" className="mb-6" aria-label={t('Pikul, ke halaman utama')}>
        <Logo size={34} />
      </a>
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-6 shadow-xs">
        {step === 'email' ? (
          <>
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">{t('Masuk atau daftar')}</h1>
            <p className="mt-1.5 text-[15px] text-ink-soft">{t('Akun baru langsung dapat 14 hari gratis. Tanpa kartu kredit.')}</p>
            <div className="mt-6">
              <GoogleButton onError={setError} />
              <form onSubmit={send} noValidate>
                <label htmlFor="signin-email" className={labelBase}>
                  {t('Email')}
                </label>
                <input id="signin-email" type="email" inputMode="email" autoComplete="email" required className={inputBase} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
                <button type="submit" className={`${btnPrimary} mt-4 w-full`} disabled={busy || !email.includes('@')}>
                  <Mail aria-hidden size={18} />
                  {busy ? t('Mengirim…') : t('Kirim kode masuk')}
                </button>
              </form>
            </div>
          </>
        ) : (
          <form onSubmit={verify} noValidate>
            <button type="button" onClick={() => setStep('email')} className={`${btnGhost} -ml-3 mb-2`}>
              <ArrowLeft aria-hidden size={18} />
              {t('Ganti email')}
            </button>
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">{t('Cek email Anda')}</h1>
            <p className="mt-1.5 text-[15px] text-ink-soft">{t('Kami mengirim kode 6 angka ke {0}.', email)}</p>
            <label htmlFor="signin-code" className={`${labelBase} mt-6`}>
              {t('Kode masuk')}
            </label>
            <input
              id="signin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${inputBase} text-center text-[24px] font-bold tracking-[0.4em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            <p className={helperText}>{t('Tidak ada di kotak masuk? Periksa folder spam.')}</p>
            <button type="submit" className={`${btnPrimary} mt-4 w-full`} disabled={busy || code.length !== 6}>
              {busy ? t('Memeriksa…') : t('Masuk')}
            </button>
            <button type="button" className={`${btnGhost} mt-2 w-full`} onClick={() => void send()} disabled={busy}>
              {t('Kirim ulang kode')}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-50 px-3 py-2.5 text-[14px] text-danger-700">
            {error}
          </p>
        )}
      </div>
      <div className="mt-6">
        <LanguagePicker />
      </div>
    </main>
  );
}

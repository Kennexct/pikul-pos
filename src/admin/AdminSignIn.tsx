import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Logo } from '../components/Brand/Logo';
import { btnGhost, btnPrimary, helperText, inputBase, labelBase } from '../components/ui/styles';
import { t } from '../i18n';
import { requestCode, verifyCode } from './api';
import { errorText } from './errors';

/** Email code sign-in; only emails in ADMIN_EMAILS get past the next step (ADR-014). */
export function AdminSignIn({ onSignedIn, notice }: { onSignedIn: () => void; notice: string | null }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === 'email') {
        await requestCode(email);
        setStep('code');
      } else {
        await verifyCode(email, code);
        onSignedIn();
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-[400px] rounded-xl border border-line bg-surface p-6 shadow-xs">
        <Logo />
        <h1 className="mt-6 flex items-center gap-2 text-[22px] font-bold tracking-[-0.02em] text-ink">
          <ShieldCheck aria-hidden size={22} className="text-brand-600" />
          {t('Konsol admin')}
        </h1>
        <p className="mt-1 text-[14px] text-muted">{t('Paket harga dan kampanye promo. Khusus pemilik KasirKu.')}</p>
        {step === 'email' ? (
          <div className="mt-6">
            <label htmlFor="admin-email" className={labelBase}>
              {t('Email')}
            </label>
            <input id="admin-email" type="email" autoComplete="email" required className={inputBase} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        ) : (
          <div className="mt-6">
            <label htmlFor="admin-code" className={labelBase}>
              {t('Kode 6 angka')}
            </label>
            <input
              id="admin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              className={`${inputBase} num tracking-[0.3em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <p className={helperText}>{t('Kode dikirim ke {0}.', email)}</p>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-[14px] text-danger-700">
            {error}
          </p>
        )}
        <button type="submit" className={`${btnPrimary} mt-5 w-full`} disabled={busy}>
          {step === 'email' ? t('Kirim kode') : t('Masuk')}
        </button>
        {step === 'code' && (
          <button type="button" className={`${btnGhost} mt-2 w-full`} onClick={() => setStep('email')}>
            {t('Ganti email')}
          </button>
        )}
      </form>
    </main>
  );
}

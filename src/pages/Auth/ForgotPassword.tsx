import { ArrowLeft, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { btnGhost, btnPrimary, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { requestCode, resetPassword } from '../../services/account';
import { useAccessStore } from '../../store/useAccessStore';
import { t } from '../../i18n';
import { authMessage } from './authErrors';
import { PasswordInput } from './PasswordInput';

/** Forgot password (ADR-023). With email set up: a 6-digit code + new password. Without: ask the admin for a temporary one. */
export function ForgotPassword({ emailReset, initialEmail, onBack }: { emailReset: boolean; initialEmail: string; onBack: () => void }) {
  const setClaims = useAccessStore((s) => s.setClaims);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      await requestCode(email.trim());
      setStep('code');
    });
  };
  const reset = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => setClaims(await resetPassword(email.trim(), code, password)));
  };

  return (
    <div>
      <button type="button" onClick={onBack} className={`${btnGhost} -ml-3 mb-2`}>
        <ArrowLeft aria-hidden size={18} />
        {t('Kembali ke masuk')}
      </button>
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t('Lupa kata sandi')}</h1>
      {!emailReset ? (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t('Hubungi admin Pikul lewat WhatsApp atau email dengan menyebut email akun Anda. Admin akan mengirim kata sandi sementara; setelah masuk, ganti di Pengaturan → Langganan & akun.')}</p>
      ) : step === 'email' ? (
        <form onSubmit={send} noValidate className="mt-4">
          <label htmlFor="forgot-email" className={labelBase}>
            {t('Email akun')}
          </label>
          <input id="forgot-email" type="email" inputMode="email" autoComplete="email" className={inputBase} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
          <button type="submit" className={`${btnPrimary} mt-4 w-full`} disabled={busy || !email.includes('@')}>
            <Mail aria-hidden size={18} />
            {busy ? t('Mengirim…') : t('Kirim kode')}
          </button>
        </form>
      ) : (
        <form onSubmit={reset} noValidate className="mt-4 space-y-4">
          <p className="text-[15px] text-ink-soft">{t('Jika email terdaftar, kami mengirim kode 6 angka ke {0}.', email.trim())}</p>
          <div>
            <label htmlFor="forgot-code" className={labelBase}>
              {t('Kode')}
            </label>
            <input id="forgot-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={`${inputBase} text-center text-[24px] font-semibold tracking-[0.4em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <p className={helperText}>{t('Tidak ada di kotak masuk? Periksa folder spam.')}</p>
          </div>
          <div>
            <label htmlFor="forgot-password" className={labelBase}>
              {t('Kata sandi baru')}
            </label>
            <PasswordInput id="forgot-password" value={password} onChange={setPassword} autoComplete="new-password" />
            <p className={helperText}>{t('Minimal 8 karakter.')}</p>
          </div>
          <button type="submit" className={`${btnPrimary} w-full`} disabled={busy || code.length !== 6 || password.length < 8}>
            {busy ? t('Menyimpan…') : t('Simpan dan masuk')}
          </button>
          <button type="button" className={`${btnGhost} w-full`} onClick={() => send()} disabled={busy}>
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
  );
}

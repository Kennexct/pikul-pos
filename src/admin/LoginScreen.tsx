import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { btnPrimary, helperText, inputBase, labelBase } from '../components/ui/styles';
import { t } from '../i18n';
import { login } from './api';
import { errorText } from './errors';

/** Admin password sign-in (ADR-020). The password lives only in the server's ADMIN_PASSWORD secret. */
export function LoginScreen({ disabled, onSignedIn }: { disabled: boolean; onSignedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(password);
      setPassword('');
      onSignedIn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-xs">
        <ShieldCheck aria-hidden size={28} className="text-brand-600" />
        <h1 className="mt-3 text-[22px] font-bold tracking-[-0.02em] text-ink">{t('Konsol admin Pikul')}</h1>
        {disabled ? (
          <p role="alert" className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            {t('Konsol belum aktif. Isi ADMIN_PASSWORD (minimal 12 karakter) di pengaturan Cloudflare Pages, lalu muat ulang halaman ini.')}
          </p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="mt-5" noValidate>
            <label htmlFor="admin-password" className={labelBase}>
              {t('Kata sandi admin')}
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputBase} pr-12`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'admin-password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink"
                aria-label={show ? t('Sembunyikan kata sandi') : t('Tampilkan kata sandi')}
              >
                {show ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
              </button>
            </div>
            {error && (
              <p id="admin-password-error" role="alert" className="mt-2 text-[14px] text-danger-700">
                {error}
              </p>
            )}
            <button type="submit" className={`${btnPrimary} mt-5 w-full`} disabled={busy || !password}>
              {busy ? t('Memeriksa…') : t('Masuk')}
            </button>
            <p className={helperText}>{t('Sesi berlaku 12 jam di tab ini.')}</p>
          </form>
        )}
      </div>
    </main>
  );
}

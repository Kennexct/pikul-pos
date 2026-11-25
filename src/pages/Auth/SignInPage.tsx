import { PrivateWindowBanner } from '../../components/Access/PrivateWindowBanner';
import { LogIn } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Logo } from '../../components/Brand/Logo';
import { LanguagePicker } from '../../components/LanguagePicker';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { btnPrimary, inputBase, labelBase } from '../../components/ui/styles';
import { authOptions, GOOGLE_CLIENT_ID, googleSignIn, passwordSignIn } from '../../services/account';
import { useAccessStore } from '../../store/useAccessStore';
import { t } from '../../i18n';
import { authMessage } from './authErrors';
import { ForgotPassword } from './ForgotPassword';
import { PasswordInput } from './PasswordInput';
import { SignUpForm } from './SignUpForm';

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } };
  }
}

type View = 'signin' | 'signup' | 'forgot';

/** #daftar / #masuk pick the tab (landing page links); otherwise a device that was used before opens on "Masuk". */
function firstView(): View {
  const hash = typeof location === 'undefined' ? '' : location.hash;
  if (hash === '#daftar') return 'signup';
  if (hash === '#masuk') return 'signin';
  try {
    return localStorage.getItem('kk.lastSeen') ? 'signin' : 'signup';
  } catch {
    return 'signup';
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
            onError(authMessage(e));
          }
        },
      });
      window.google.accounts.id.renderButton(el.current, { theme: 'outline', size: 'large', width: 320, text: 'signin_with' });
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

function SignInForm({ email, setEmail, onForgot }: { email: string; setEmail: (v: string) => void; onForgot: () => void }) {
  const setClaims = useAccessStore((s) => s.setClaims);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setClaims(await passwordSignIn(email.trim(), password));
    } catch (err) {
      setError(authMessage(err));
      setBusy(false);
    }
  };
  return (
    <>
      <GoogleButton onError={setError} />
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <div>
          <label htmlFor="signin-email" className={labelBase}>
            {t('Email')}
          </label>
          <input id="signin-email" type="email" inputMode="email" autoComplete="email" className={inputBase} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
        </div>
        <div>
          <div className="flex items-end justify-between">
            <label htmlFor="signin-password" className={labelBase}>
              {t('Kata sandi')}
            </label>
            <button type="button" onClick={onForgot} className="mb-1 min-h-11 px-1 text-[13px] font-semibold text-brand-700 hover:underline">
              {t('Lupa kata sandi?')}
            </button>
          </div>
          <PasswordInput id="signin-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2.5 text-[14px] text-danger-700">
            {error}
          </p>
        )}
        <button type="submit" className={`${btnPrimary} w-full`} disabled={busy || !email.includes('@') || !password}>
          <LogIn aria-hidden size={18} />
          {busy ? t('Memeriksa…') : t('Masuk')}
        </button>
      </form>
    </>
  );
}

/** ADR-013 + ADR-023: an account comes before the POS. "Daftar" creates it (14-day trial), "Masuk" signs in with a password. */
export function SignInPage() {
  const [view, setView] = useState<View>(firstView);
  const [email, setEmail] = useState('');
  const [emailReset, setEmailReset] = useState(false);
  useEffect(() => {
    authOptions()
      .then((o) => setEmailReset(o.emailReset))
      .catch(() => undefined);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-8 text-ink md:justify-center">
      <a href="/" className="mb-6" aria-label={t('Pikul, ke halaman utama')}>
        <Logo size={34} />
      </a>
      <PrivateWindowBanner variant="card" />
      <div className="w-full max-w-[440px] rounded-xl border border-line bg-surface p-6 shadow-xs">
        {view === 'forgot' ? (
          <ForgotPassword emailReset={emailReset} initialEmail={email} onBack={() => setView('signin')} />
        ) : (
          <>
            <SegmentedControl
              label={t('Masuk atau daftar')}
              isFullWidth
              value={view}
              onChange={setView}
              options={[
                { value: 'signin', label: t('Masuk') },
                { value: 'signup', label: t('Daftar') },
              ]}
            />
            <h1 className="mt-5 text-[22px] font-bold tracking-[-0.02em]">{view === 'signup' ? t('Daftar akun Pikul') : t('Masuk ke Pikul')}</h1>
            <p className="mb-5 mt-1.5 text-[15px] text-ink-soft">{view === 'signup' ? t('Akun baru langsung dapat 14 hari gratis. Tanpa kartu kredit.') : t('Masuk dengan email dan kata sandi akun toko Anda.')}</p>
            {view === 'signup' ? <SignUpForm /> : <SignInForm email={email} setEmail={setEmail} onForgot={() => setView('forgot')} />}
          </>
        )}
      </div>
      <div className="mt-6">
        <LanguagePicker />
      </div>
    </main>
  );
}

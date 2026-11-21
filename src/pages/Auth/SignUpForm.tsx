import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { btnPrimary, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { signUp, type SignUpInput } from '../../services/account';
import { useAccessStore } from '../../store/useAccessStore';
import { t } from '../../i18n';
import { authMessage } from './authErrors';
import { PasswordInput } from './PasswordInput';

const EMPTY: SignUpInput = { ownerName: '', storeName: '', phone: '', city: '', email: '', password: '' };

/** Sign-up (ADR-023): every field here is shown to the Pikul admin under Merchant. Starts the 14-day trial. */
export function SignUpForm() {
  const setClaims = useAccessStore((s) => s.setClaims);
  const [form, setForm] = useState<SignUpInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof SignUpInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const filled = form.ownerName.trim().length >= 2 && form.storeName.trim().length >= 2 && form.phone.trim().length >= 9 && form.city.trim().length >= 2 && form.email.includes('@') && form.password.length >= 8;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!filled || busy) return;
    setBusy(true);
    setError(null);
    try {
      setClaims(await signUp({ ...form, email: form.email.trim() }));
    } catch (err) {
      setError(authMessage(err));
      setBusy(false);
    }
  };

  const field = (k: Exclude<keyof SignUpInput, 'password'>, label: string, props: { type?: string; inputMode?: 'email' | 'tel' | 'text'; autoComplete: string; placeholder?: string; maxLength: number }) => (
    <div>
      <label htmlFor={`signup-${k}`} className={labelBase}>
        {label}
      </label>
      <input id={`signup-${k}`} type={props.type ?? 'text'} inputMode={props.inputMode} autoComplete={props.autoComplete} placeholder={props.placeholder} maxLength={props.maxLength} className={inputBase} value={form[k]} onChange={(e) => set(k)(e.target.value)} />
    </div>
  );

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {field('ownerName', t('Nama pemilik'), { autoComplete: 'name', placeholder: t('mis. Budi Santoso'), maxLength: 80 })}
      {field('storeName', t('Nama toko'), { autoComplete: 'organization', placeholder: t('mis. Bakso Pak Kumis'), maxLength: 80 })}
      {field('phone', t('Nomor WhatsApp'), { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '0812 3456 7890', maxLength: 20 })}
      {field('city', t('Kota / kabupaten'), { autoComplete: 'address-level2', placeholder: t('mis. Bandung'), maxLength: 60 })}
      {field('email', t('Email'), { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'nama@email.com', maxLength: 254 })}
      <div>
        <label htmlFor="signup-password" className={labelBase}>
          {t('Kata sandi')}
        </label>
        <PasswordInput id="signup-password" value={form.password} onChange={set('password')} autoComplete="new-password" describedBy="signup-password-help" />
        <p id="signup-password-help" className={helperText}>
          {t('Minimal 8 karakter.')}
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2.5 text-[14px] text-danger-700">
          {error}
        </p>
      )}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={busy || !filled}>
        <UserPlus aria-hidden size={18} />
        {busy ? t('Mendaftarkan…') : t('Daftar dan mulai 14 hari gratis')}
      </button>
      <p className="text-center text-[13px] text-muted">{t('Data ini dipakai tim Pikul untuk menghubungi Anda soal akun dan langganan.')}</p>
    </form>
  );
}

import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { btnPrimary, btnSecondary, fieldGrid, helperText, labelBase } from '../../components/ui/styles';
import { changePassword } from '../../services/account';
import { useAccessStore } from '../../store/useAccessStore';
import { t } from '../../i18n';
import { authMessage } from '../Auth/authErrors';
import { PasswordInput } from '../Auth/PasswordInput';

/** Settings → Akun → change password (ADR-023). Other devices are signed out; this one stays in. */
export function ChangePassword() {
  const setClaims = useAccessStore((s) => s.setClaims);
  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setClaims(await changePassword(current, next));
      toast.success(t('Kata sandi diganti. Perangkat lain perlu masuk lagi.'));
      setIsOpen(false);
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen)
    return (
      <button type="button" className={btnSecondary} onClick={() => setIsOpen(true)}>
        <KeyRound aria-hidden size={18} />
        {t('Ganti kata sandi')}
      </button>
    );
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <div className={fieldGrid}>
        <div>
          <label htmlFor="pw-current" className={labelBase}>
            {t('Kata sandi sekarang')}
          </label>
          <PasswordInput id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" />
        </div>
        <div>
          <label htmlFor="pw-new" className={labelBase}>
            {t('Kata sandi baru')}
          </label>
          <PasswordInput id="pw-new" value={next} onChange={setNext} autoComplete="new-password" />
          <p className={helperText}>{t('Minimal 8 karakter.')}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2.5 text-[14px] text-danger-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className={btnSecondary} onClick={() => setIsOpen(false)}>
          {t('Batal')}
        </button>
        <button type="submit" className={btnPrimary} disabled={busy || !current || next.length < 8}>
          {busy ? t('Menyimpan…') : t('Simpan')}
        </button>
      </div>
    </form>
  );
}

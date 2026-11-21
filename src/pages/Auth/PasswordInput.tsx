import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { inputBase } from '../../components/ui/styles';
import { t } from '../../i18n';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  describedBy?: string;
}

/** Password field with a show/hide button (44 px target). */
export function PasswordInput({ id, value, onChange, autoComplete, describedBy }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} maxLength={128} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputBase} pr-12`} aria-describedby={describedBy} />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink" aria-label={show ? t('Sembunyikan kata sandi') : t('Tampilkan kata sandi')}>
        {show ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
      </button>
    </div>
  );
}

import { Delete } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../../constants';
import { formatWait } from '../../lib/lockout';
import type { PinCheck } from '../../services/staff';
import { t } from '../../i18n';

interface PinPadProps {
  /** Accessible name, e.g. "PIN pemilik" or "PIN Dika". */
  label: string;
  verify: (pin: string) => Promise<PinCheck>;
  onSuccess: () => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const TICK_MS = 500;
const keyClass =
  'num flex h-16 items-center justify-center rounded-lg border border-line-strong bg-surface text-[24px] font-semibold text-ink shadow-xs transition-colors hover:bg-subtle active:bg-line disabled:opacity-40';

/** Large numeric keypad for PIN entry. The PIN lives only in this component's state. */
export function PinPad({ label, verify, onSuccess }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => root.current?.focus(), []);
  useEffect(() => {
    if (lockedUntil === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const lockedMs = lockedUntil !== null ? Math.max(0, lockedUntil - now) : 0;
  const isLocked = lockedMs > 0;
  const isDisabled = isBusy || isLocked;
  const canSubmit = !isDisabled && pin.length >= PIN_MIN_LENGTH;

  const press = (digit: string) => {
    if (isDisabled || pin.length >= PIN_MAX_LENGTH) return;
    setError(null);
    setPin((prev) => prev + digit);
  };
  const erase = () => !isDisabled && setPin((prev) => prev.slice(0, -1));

  const submit = async () => {
    if (!canSubmit) return;
    setIsBusy(true);
    try {
      const result = await verify(pin);
      if (result.ok) {
        onSuccess();
        return;
      }
      setPin('');
      setError(result.error);
      setLockedUntil(result.lockedMs > 0 ? Date.now() + result.lockedMs : null);
      setNow(Date.now());
    } catch {
      setPin('');
      setError(t('PIN tidak bisa diperiksa. Coba lagi.'));
    } finally {
      setIsBusy(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (/^\d$/.test(event.key)) press(event.key);
    else if (event.key === 'Backspace') erase();
    else if (event.key === 'Enter') void submit();
  };

  return (
    <div ref={root} role="group" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown} className="mx-auto w-full max-w-[280px] outline-none">
      <div aria-hidden className="mb-2 flex h-8 items-center justify-center gap-3">
        {Array.from({ length: PIN_MAX_LENGTH }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition-colors ${
              i < pin.length ? 'bg-brand-600' : i < PIN_MIN_LENGTH ? 'border-2 border-line-input' : 'border-2 border-line'
            }`}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{pin.length} {t('digit dimasukkan')}</p>
      <p role="alert" className={`mb-3 min-h-10 text-center text-[13px] ${error ? 'text-danger-700' : 'text-muted'}`}>
        {isLocked ? t('Terlalu banyak percobaan. Coba lagi dalam {0}.', formatWait(lockedMs)) : (error ?? t('{0}–{1} angka, lalu OK', PIN_MIN_LENGTH, PIN_MAX_LENGTH))}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <button key={digit} type="button" disabled={isDisabled} onClick={() => press(digit)} className={keyClass}>
            {digit}
          </button>
        ))}
        <button type="button" aria-label={t('Hapus angka')} disabled={isDisabled || pin.length === 0} onClick={erase} className={keyClass}>
          <Delete aria-hidden size={22} />
        </button>
        <button type="button" disabled={isDisabled} onClick={() => press('0')} className={keyClass}>
          0
        </button>
        <button
          type="button"
          aria-label={t('OK')}
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="flex h-16 items-center justify-center rounded-lg bg-brand-600 text-[17px] font-semibold text-white shadow-xs transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {isBusy ? '…' : t('OK')}
        </button>
      </div>
    </div>
  );
}

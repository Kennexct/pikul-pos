import { Delete } from 'lucide-react';
import type { PointerEvent } from 'react';
import { t } from '../../i18n';
import type { KeypadKey } from '../../lib/keypad';

interface KeypadProps {
  /** Accessible name, e.g. "Papan angka". */
  label?: string;
  onKey: (key: KeypadKey) => void;
  /** Bottom-left key: "," for weights, "000" for Rupiah, none for percent. */
  extraKey?: ',' | '000' | null;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const keyClass =
  'num flex h-12 items-center justify-center rounded-lg border border-line-strong bg-surface text-[20px] font-semibold text-ink shadow-xs transition-colors select-none hover:bg-subtle active:bg-line';

/** Keeps focus (and the caret) in the field: a key press never blurs it or opens the system keyboard. */
const keepFocus = (event: PointerEvent) => event.preventDefault();

/**
 * In-app number pad for weight, price and cash (ADR-029). Sits in the sheet footer above the main button,
 * so the system keyboard never opens and never covers the sheet (iPad Safari overlays it on the page).
 */
export function Keypad({ label = t('Papan angka'), onKey, extraKey = '000' }: KeypadProps) {
  const key = (value: KeypadKey, content: string, ariaLabel?: string) => (
    <button key={value} type="button" aria-label={ariaLabel} onPointerDown={keepFocus} onClick={() => onKey(value)} className={keyClass}>
      {content}
    </button>
  );
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-1.5">
      {DIGITS.map((digit) => key(digit, digit))}
      {extraKey ? key(extraKey, extraKey, extraKey === ',' ? t('Koma') : undefined) : <span aria-hidden />}
      {key('0', '0')}
      <button type="button" aria-label={t('Hapus angka')} onPointerDown={keepFocus} onClick={() => onKey('back')} className={keyClass}>
        <Delete aria-hidden size={22} strokeWidth={1.75} />
      </button>
    </div>
  );
}

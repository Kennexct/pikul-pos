import { useRef } from 'react';
import { LOCALE } from '../../constants';
import { parseRupiah } from '../../lib/money';
import { inputBase } from './styles';

interface RupiahInputProps {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  size?: 'md' | 'lg';
  /** Enter / "next" key on the phone keypad. */
  onEnter?: () => void;
  enterKeyHint?: 'next' | 'done';
}

const groupFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** Numeric keypad input that shows thousand separators ("12.500") and emits integer Rupiah. */
/**
 * Focus selects the whole amount, so typing replaces it instead of landing beside an existing "0"
 * (typing 10.000 used to become 100.000).
 */
export function RupiahInput({ id, value, onChange, placeholder = '0', autoFocus, ariaLabel, size = 'md', onEnter, enterKeyHint }: RupiahInputProps) {
  /** Safari/iOS collapse the selection on the mouseup that follows focus; skip that one. */
  const justFocused = useRef(false);
  const sizeClass = size === 'lg' ? 'h-14 text-[22px] font-bold' : 'font-semibold';
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[14px] font-semibold text-muted">Rp</span>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value === null ? '' : groupFormatter.format(value)}
        enterKeyHint={enterKeyHint}
        onFocus={(event) => {
          justFocused.current = true;
          event.currentTarget.select();
        }}
        onMouseUp={(event) => {
          if (justFocused.current) event.preventDefault();
          justFocused.current = false;
        }}
        onBlur={() => {
          justFocused.current = false;
        }}
        onKeyDown={(event) => {
          justFocused.current = false;
          if (event.key === 'Enter' && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        onChange={(event) => onChange(parseRupiah(event.target.value))}
        className={`${inputBase} num pl-11 text-right ${sizeClass}`}
      />
    </div>
  );
}

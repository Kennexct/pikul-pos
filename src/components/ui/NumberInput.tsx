import { useEffect, useRef, useState } from 'react';
import { inputBase } from './styles';

interface NumberInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  /** Saves on leaving the field instead of on every key (sales mode markup). */
  onCommit?: (value: number) => void;
  min?: number;
  max: number;
  /** Whole numbers only (days, max picks); otherwise one decimal mark is allowed (11,5 %). */
  isInteger?: boolean;
  className?: string;
}

const toText = (value: number, min: number): string => (value === min && min === 0 ? '' : String(value).replace('.', ','));

/** Typed text → number inside [min, max]; empty or unreadable is min. Accepts "11,5" and "11.5". */
export function parseNumber(raw: string, min: number, max: number, isInteger: boolean): number {
  const n = Number(raw.replace(',', '.'));
  if (raw.trim() === '' || !Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, isInteger ? Math.round(n) : n));
}

/**
 * Small number field (%, days, counts). A zero shows as the grey "0" placeholder, so typing never
 * lands beside an existing 0 (Kenny: "make sure the 0 is placeholder"); focus selects what is there.
 */
export function NumberInput({ id, value, onChange, onCommit, min = 0, max, isInteger = false, className = '' }: NumberInputProps) {
  const [text, setText] = useState(() => toText(value, min));
  const justFocused = useRef(false);

  // Follow outside changes (Batal, another device) without fighting the text being typed.
  useEffect(() => {
    setText((current) => (parseNumber(current, min, max, isInteger) === value ? current : toText(value, min)));
  }, [value, min, max, isInteger]);

  const parse = (raw: string): number => parseNumber(raw, min, max, isInteger);

  return (
    <input
      id={id}
      inputMode={isInteger ? 'numeric' : 'decimal'}
      autoComplete="off"
      placeholder={String(min)}
      value={text}
      onFocus={(event) => {
        justFocused.current = true;
        event.currentTarget.select();
      }}
      onMouseUp={(event) => {
        if (justFocused.current) event.preventDefault();
        justFocused.current = false;
      }}
      onKeyDown={() => {
        justFocused.current = false;
      }}
      onChange={(event) => {
        const cleaned = isInteger ? event.target.value.replace(/\D/g, '') : event.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/, '$1');
        const next = parse(cleaned);
        setText(Number(cleaned.replace(',', '.')) > max ? toText(next, min) : cleaned);
        onChange(next);
      }}
      onBlur={() => {
        justFocused.current = false;
        const next = parse(text);
        setText(toText(next, min));
        onCommit?.(next);
      }}
      className={`${inputBase} num ${className}`}
    />
  );
}

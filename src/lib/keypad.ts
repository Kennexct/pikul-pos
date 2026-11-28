/**
 * In-app number pad (ADR-029): what one key press does to the text of a number field.
 * Pure, so the rules are tested without a browser. "Fresh" = the field was just picked,
 * so the first key replaces what is there (like a selected field on a real keyboard).
 */

/** Digit keys, the decimal comma, the "000" shortcut for Rupiah, and erase. */
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | '000' | 'back';

export interface KeypadRules {
  /** Allows one decimal comma (weights). */
  isDecimal?: boolean;
  /** Digits after the comma (weights: 3). */
  maxDecimals?: number;
  /** Digits before the comma; extra presses are ignored. */
  maxDigits?: number;
}

const isDigit = (key: KeypadKey): boolean => /^\d+$/.test(key);

/** Next text after one key. Never returns leading zeros ("05" → "5") or a second comma. */
export function applyKeypadKey(current: string, key: KeypadKey, isFresh: boolean, rules: KeypadRules = {}): string {
  const { isDecimal = false, maxDecimals = 3, maxDigits = 12 } = rules;
  const text = isFresh ? '' : current;
  if (key === 'back') return text.slice(0, -1);
  if (key === ',') {
    if (!isDecimal || text.includes(',')) return text;
    return text === '' ? '0,' : `${text},`;
  }
  if (!isDigit(key)) return text;
  const [whole = '', decimals] = text.split(',');
  if (decimals !== undefined) {
    const room = maxDecimals - decimals.length;
    return room <= 0 ? text : `${text}${key.slice(0, room)}`;
  }
  const nextWhole = `${whole}${key}`.replace(/^0+(?=\d)/, '');
  return nextWhole.length > maxDigits ? text : nextWhole;
}

/** Same for a whole-number field kept as a number (Rupiah, percent); empty is null. */
export function applyKeypadKeyToNumber(current: number | null, key: KeypadKey, isFresh: boolean, maxDigits = 12): number | null {
  const next = applyKeypadKey(current === null ? '' : String(current), key, isFresh, { maxDigits });
  return next === '' ? null : Number(next);
}

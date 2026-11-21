import { EN } from './en';

/**
 * Interface language (ADR-010). The Indonesian sentence in the code is the key; `en.ts` holds the English.
 * A sentence without an English entry does not compile. The language is read once at startup — changing it reloads.
 */
export type Lang = 'id' | 'en';
export type Msg = keyof typeof EN;
type Arg = string | number;

/** Legacy identifier, frozen (ADR-016). */
export const LANGUAGE_STORAGE_KEY = 'kasirku-lang';
export const LANGUAGES: ReadonlyArray<{ value: Lang; label: string }> = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
];

const PLACEHOLDER = /\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}/g;

/** `{0}` inserts an argument; `{0|order|orders}` picks a word by whether argument 0 is exactly 1. */
function fill(template: string, args: readonly Arg[]): string {
  if (args.length === 0) return template;
  return template.replace(PLACEHOLDER, (_match, index: string, singular?: string, plural?: string) => {
    const value = args[Number(index)];
    if (singular === undefined || plural === undefined) return value === undefined ? '' : String(value);
    return Number(value) === 1 ? singular : plural;
  });
}

/** A key may end in `::hint` when one Indonesian word needs two English ones ("Kasir" the screen, "Kasir::orang" the person). */
const CONTEXT = /::[a-z]+$/;

/** Pure translation, used by `t` and by tests. */
export function translate(language: Lang, key: Msg, ...args: Arg[]): string {
  return fill(language === 'en' ? EN[key] : key.replace(CONTEXT, ''), args);
}

function detectLanguage(): Lang {
  // Unit tests assert the Indonesian wording.
  if (import.meta.env.MODE === 'test') return 'id';
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'id' || stored === 'en') return stored;
  } catch {
    // Storage blocked: fall through to the device language.
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'id';
}

export const lang: Lang = detectLanguage();
/** For dates and weekday/month names. Money keeps Indonesian formatting in both languages. */
export const DATE_LOCALE = lang === 'en' ? 'en-GB' : 'id-ID';

export const t = (key: Msg, ...args: Arg[]): string => translate(lang, key, ...args);

/** Saves the choice and reloads, so module-level labels and date formatters are rebuilt in the new language. */
export function setLanguage(next: Lang): void {
  if (next === lang) return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    return;
  }
  window.location.reload();
}

if (typeof document !== 'undefined') document.documentElement.lang = lang;

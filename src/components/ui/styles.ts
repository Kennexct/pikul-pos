/**
 * Shared class strings built ONLY from semantic tokens (src/index.css).
 * Touch targets: 44px minimum, 48px for primary actions.
 */
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg text-[15px] font-semibold transition-[background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45';

export const btnPrimary = `${btnBase} h-12 px-5 bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800`;
export const btnSecondary = `${btnBase} h-12 px-4 border border-line-strong bg-surface text-ink shadow-xs hover:bg-subtle`;
export const btnGhost = `${btnBase} h-11 px-3 text-ink-soft hover:bg-subtle`;
export const btnDanger = `${btnBase} h-12 px-4 border border-danger-200 bg-surface text-danger-700 hover:bg-danger-50`;
export const btnDangerSolid = `${btnBase} h-12 px-5 bg-danger-600 text-white shadow-xs hover:bg-danger-700`;
export const btnIcon =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-soft transition-colors hover:bg-subtle active:bg-line disabled:opacity-40';

export const inputBase =
  'h-12 w-full rounded-lg border border-line-input bg-surface px-3.5 text-[15px] text-ink outline-none transition-shadow focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/15';
/** Number field the in-app keypad types into (ADR-029): keeps the focus look while a key or chip is pressed. */
export const keypadTarget = 'data-[keypad=active]:border-brand-600 data-[keypad=active]:ring-[3px] data-[keypad=active]:ring-brand-600/15';
export const labelBase = 'mb-1.5 block text-[13px] font-semibold text-ink-soft';
/**
 * Form fields in a settings card (Kenny: "field size is not consistent"): one equal-width column per
 * field, two side by side once the card is wide enough. Every input fills its cell; no ad-hoc widths.
 * The card body must be `@container/card` (SettingsSection does this).
 */
export const fieldGrid = 'grid gap-4 @xl/card:grid-cols-2';

export const helperText = 'mt-1.5 text-[13px] text-muted';
export const sectionTitle = 'text-[13px] font-semibold text-muted';
export const card = 'rounded-lg border border-line bg-surface';
export const pageTitle = 'text-[22px] font-semibold tracking-[-0.02em] text-ink';

/** Selectable option (variants, quick amounts, presets): square-ish, not pills. */
export const option = (isSelected: boolean): string =>
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3.5 text-[14px] font-medium transition-colors ${
    isSelected
      ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600'
      : 'border-line-strong bg-surface text-ink-soft hover:bg-subtle'
  }`;

/** Back-compat alias used by older call sites. */
export const chip = option;

export const badgeNeutral = 'inline-flex h-6 items-center rounded-md bg-subtle px-2 text-[12px] font-semibold text-ink-soft';
export const badgeWarn = 'inline-flex h-6 items-center rounded-md bg-warn-50 px-2 text-[12px] font-semibold text-warn-700';
export const badgeBrand = 'inline-flex h-6 items-center rounded-md bg-brand-50 px-2 text-[12px] font-semibold text-brand-700';

/** Pikul's signature: the dashed thermal-receipt rule, drawn only above (or under) a money total. Add a side, e.g. `border-t`. */
export const receiptRule = 'border-dashed border-line-strong';

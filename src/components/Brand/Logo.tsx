interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

/**
 * Pikul logomark (ADR-016, brand kit v1): a seller's head, a bent carrying pole and two equal loads,
 * on a pandan tile. Reads as a street seller with a pikulan and as a balance — tidy books.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14.4" fill="var(--color-brand-600)" />
      <g transform="translate(7.86 10.13) scale(0.7543)">
        <circle cx="32" cy="14" r="6.5" fill="var(--color-kunyit)" />
        <path d="M7 32Q32 22 57 32" fill="none" stroke="var(--color-santan)" strokeWidth="6" strokeLinecap="round" />
        <rect x="13" y="29" width="4" height="11" fill="var(--color-santan)" />
        <rect x="47" y="29" width="4" height="11" fill="var(--color-santan)" />
        <path d="M4 39.5h22a11 11 0 0 1-22 0z" fill="var(--color-santan)" />
        <path d="M38 39.5h22a11 11 0 0 1-22 0z" fill="var(--color-santan)" />
      </g>
    </svg>
  );
}

export function Logo({ size = 32, withWordmark = true }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      {withWordmark && <span className="text-[19px] font-extrabold tracking-[-0.03em] text-ink">Pikul</span>}
    </span>
  );
}

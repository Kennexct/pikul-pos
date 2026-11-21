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

/** Outlined wordmark (Plus Jakarta Sans ExtraBold, brand kit v1), so it renders the same with or without the font. */
const WORDMARK_PATH =
  'M55 200V-546H195V-442L182 -472Q209 -513 256 -536Q302 -558 362 -558Q440 -558 503 -520Q566 -482 603 -418Q640 -353 640 -273Q640 -194 604 -129Q567 -64 504 -26Q441 12 361 12Q305 12 258 -8Q210 -29 181 -69L205 -100V200ZM343 -123Q385 -123 417 -142Q449 -161 467 -195Q485 -229 485 -273Q485 -317 467 -350Q449 -384 417 -404Q385 -423 343 -423Q303 -423 272 -404Q240 -385 222 -351Q205 -317 205 -273Q205 -229 222 -195Q240 -161 272 -142Q303 -123 343 -123ZM708 0V-546H858V0ZM708 -595V-745H858V-595ZM948 0V-757H1098V-272L1042 -290L1283 -546H1468L1270 -326L1467 0H1297L1132 -277L1219 -299L1052 -117L1098 -204V0ZM1710 12Q1644 12 1598 -16Q1551 -45 1527 -96Q1503 -147 1503 -215V-546H1653V-227Q1653 -196 1666 -172Q1678 -149 1701 -136Q1724 -123 1753 -123Q1783 -123 1806 -136Q1828 -149 1840 -172Q1853 -196 1853 -227V-546H2003V0H1863V-108L1871 -84Q1852 -35 1810 -12Q1767 12 1710 12ZM2093 0V-757H2243V0Z';

export function Wordmark({ height = 18 }: { height?: number }) {
  return (
    <svg height={height} viewBox="55 -757 2188 957" role="img" aria-label="Pikul" focusable="false" className="block text-ink">
      <path d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}

export function Logo({ size = 32, withWordmark = true }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      {withWordmark && <Wordmark height={Math.round(size * 0.62)} />}
    </span>
  );
}

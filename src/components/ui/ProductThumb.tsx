interface ProductThumbProps {
  name: string;
  photoUrl?: string;
  className?: string;
}

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Product photo, or a quiet neutral monogram when there is none (PRD M3).
 * Deliberately monochrome: the photo — not random pastel colors or a stock dot texture — should be the only
 * color and pattern on a tile. The initials sit straight on the well, so the 40px list thumb stays one box.
 */
export function ProductThumb({ name, photoUrl, className = '' }: ProductThumbProps) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" loading="lazy" decoding="async" className={`bg-subtle object-cover ${className}`} />;
  }
  return (
    <div aria-hidden className={`@container flex items-center justify-center bg-subtle ${className}`}>
      <span className="text-[clamp(13px,20cqw,26px)] font-bold tracking-[-0.02em] text-muted">{monogram(name)}</span>
    </div>
  );
}

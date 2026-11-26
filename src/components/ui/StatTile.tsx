import { card } from './styles';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  isPrimary?: boolean;
  /** Primary tile spans the full row on phone (3-col grid). */
  className?: string;
}

/** KPI tile: label, big tabular value, optional hint (hidden on phone for secondary tiles). */
export function StatTile({ label, value, hint, isPrimary = false, className = '' }: StatTileProps) {
  return (
    <div className={`${card} min-w-0 px-3 py-3 md:px-4 ${isPrimary ? 'col-span-3 border-brand-200 bg-brand-50 md:col-span-1' : ''} ${className}`}>
      <p className={`truncate text-[13px] font-medium ${isPrimary ? 'text-brand-800' : 'text-muted'}`}>{label}</p>
      <p className={`num truncate font-semibold tracking-[-0.02em] ${isPrimary ? 'text-[24px] text-brand-900 md:text-[22px]' : 'text-[16px] text-ink md:text-[22px]'}`}>
        {value}
      </p>
      {hint && <p className={`num text-[12px] text-muted ${isPrimary ? '' : 'hidden truncate md:block'}`}>{hint}</p>}
    </div>
  );
}

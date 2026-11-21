import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { btnSecondary, card } from '../components/ui/styles';
import { t } from '../i18n';
import type { AccountView } from './api';
import { errorText } from './errors';
import { STATUS_CLASS, STATUS_LABEL } from './format';

/** Small building blocks shared by the console tabs. */
export function PanelHead({ title, hint, actions }: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        {hint && <p className="text-[14px] text-muted">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusChip({ status }: { status: AccountView['status'] }) {
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[12px] font-semibold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={`${card} flex flex-col items-start gap-3 p-4`} role="alert">
      <p className="text-[15px] text-danger-700">{errorText(error)}</p>
      <button type="button" className={btnSecondary} onClick={onRetry}>
        <RefreshCw aria-hidden size={18} />
        {t('Coba lagi')}
      </button>
    </div>
  );
}

export function Section({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`${card} p-4 md:p-5 ${className}`}>
      <h3 className="text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Horizontal share bars (payment mix, sales modes): label, bar, value. */
export function ShareBars({ rows, format }: { rows: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + Math.max(0, r.value), 0);
  if (rows.length === 0 || total === 0) return <p className="text-[14px] text-muted">{t('Belum ada data.')}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate font-medium text-ink">{r.label}</span>
            <span className="num shrink-0 text-ink-soft">
              {format(r.value)} <span className="text-muted">· {Math.round((Math.max(0, r.value) / total) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-subtle" aria-hidden>
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(Math.max(0, r.value) / max) * 100}%` }} />
          </div>
          {r.sub && <p className="num mt-0.5 text-[12px] text-muted">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

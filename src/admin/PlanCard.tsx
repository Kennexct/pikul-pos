import { ArrowDown, ArrowUp, Check, Pencil } from 'lucide-react';
import { badgeBrand, badgeNeutral, btnIcon, btnSecondary, card } from '../components/ui/styles';
import { formatRupiah } from '../lib/money';
import { t } from '../i18n';
import type { PlanDef } from './api';

type Shown = Pick<PlanDef, 'name' | 'amount' | 'days' | 'note' | 'badge' | 'features'>;

/** How a plan looks on the landing page price grid (after src/landing/live.ts planCard), text only. */
export function PlanFace({ plan, isCompact = false }: { plan: Shown; isCompact?: boolean }) {
  const features = plan.features.filter((f) => f.trim());
  return (
    <div className={`flex min-w-0 flex-col ${isCompact ? 'gap-2.5' : 'gap-3'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`min-w-0 truncate font-extrabold text-ink ${isCompact ? 'text-[16px]' : 'text-[18px]'}`}>{plan.name || t('(Nama paket)')}</p>
        {plan.badge && <span className="shrink-0 rounded-full bg-subtle px-2.5 py-0.5 text-[12px] font-bold text-ink-soft">{plan.badge}</span>}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`num font-extrabold tracking-[-0.03em] text-ink ${isCompact ? 'text-[24px]' : 'text-[30px]'}`}>{formatRupiah(plan.amount)}</span>
        <span className="num text-[14px] text-muted">{t('/ {0} hari', plan.days)}</span>
      </p>
      {plan.note && <p className="text-[14px] leading-relaxed break-words text-ink-soft">{plan.note}</p>}
      {features.length > 0 && (
        <ul className="space-y-1.5">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-[14px] leading-snug break-words text-ink-soft">
              <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-brand-600" />
              <span className="min-w-0">{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface CardProps {
  plan: PlanDef;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onEdit: () => void;
  onMove: (by: -1 | 1) => void;
}

/** Read-only plan in the console list (ADR-024): nothing can be typed here; Ubah opens the editor. */
export function PlanCard({ plan, isFirst, isLast, busy, onEdit, onMove }: CardProps) {
  return (
    <article className={`${card} flex flex-col gap-4 p-4 md:p-5 ${plan.active ? '' : 'bg-subtle'}`} aria-label={plan.name}>
      <div className="flex items-center gap-2">
        <span className={plan.active ? badgeBrand : badgeNeutral}>{plan.active ? t('Dijual') : t('Disembunyikan')}</span>
        <span className="num min-w-0 flex-1 truncate text-[12px] text-muted">{t('Kode: {0}', plan.id)}</span>
        <button type="button" className={btnIcon} disabled={busy || isFirst} onClick={() => onMove(-1)} aria-label={t('Naikkan {0}', plan.name)}>
          <ArrowUp aria-hidden size={18} />
        </button>
        <button type="button" className={btnIcon} disabled={busy || isLast} onClick={() => onMove(1)} aria-label={t('Turunkan {0}', plan.name)}>
          <ArrowDown aria-hidden size={18} />
        </button>
      </div>
      <div className={plan.active ? '' : 'opacity-70'}>
        <PlanFace plan={plan} />
      </div>
      <button type="button" className={`${btnSecondary} mt-auto`} disabled={busy} onClick={onEdit} aria-label={t('Ubah paket {0}', plan.name)}>
        <Pencil aria-hidden size={18} />
        {t('Ubah')}
      </button>
    </article>
  );
}

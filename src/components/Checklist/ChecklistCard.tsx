import { ChevronRight, CircleCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ChecklistState } from '../../hooks/useChecklist';
import { card } from '../ui/styles';
import { t } from '../../i18n';

/** Full "Langkah awal" list on the help page. Done items are ticked from the data, not by hand. */
export function ChecklistCard({ checklist }: { checklist: ChecklistState }) {
  const percent = Math.round((checklist.done / checklist.total) * 100);
  return (
    <section aria-label={t('Langkah awal')} className={`${card} overflow-hidden`}>
      <header className="px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{t('Langkah awal')}</h2>
          <p className="num text-[13px] font-semibold text-muted">{checklist.isComplete ? t('Semua selesai') : t('{0} dari {1} selesai', checklist.done, checklist.total)}</p>
        </div>
        <div role="progressbar" aria-label={t('Kemajuan langkah awal')} aria-valuemin={0} aria-valuemax={checklist.total} aria-valuenow={checklist.done} className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </header>
      <ul className="divide-y divide-line border-t border-line">
        {checklist.items.map((item) => (
          <li key={item.id}>
            <Link to={item.to} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-subtle">
              {item.isDone ? (
                <CircleCheck aria-label={t('selesai')} size={22} className="shrink-0 text-brand-600" />
              ) : (
                <span aria-label={t('belum')} role="img" className="h-[22px] w-[22px] shrink-0 rounded-full border-2 border-line-strong" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] font-semibold ${item.isDone ? 'text-muted line-through decoration-line-strong' : 'text-ink'}`}>{item.label}</span>
                {!item.isDone && <span className="block text-[13px] text-muted">{item.hint}</span>}
              </span>
              {!item.isDone && <ChevronRight aria-hidden size={18} className="shrink-0 text-faint" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

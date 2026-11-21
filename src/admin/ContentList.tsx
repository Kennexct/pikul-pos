import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { btnIcon, btnSecondary, card, inputBase, labelBase } from '../components/ui/styles';
import { t } from '../i18n';

export interface Field {
  key: string;
  label: string;
  max: number;
  isLong?: boolean;
}
type Row = { hidden: boolean };

interface Props<T extends Row> {
  title: string;
  hint: string;
  items: T[];
  fields: readonly Field[];
  max: number;
  addLabel: string;
  blank: () => T;
  onChange: (items: T[]) => void;
}

const move = <T,>(xs: T[], i: number, by: number) => {
  const j = i + by;
  if (j < 0 || j >= xs.length) return xs;
  const out = [...xs];
  const a = out[i];
  const b = out[j];
  if (a === undefined || b === undefined) return xs;
  out[i] = b;
  out[j] = a;
  return out;
};

/** Ordered list editor for landing features and FAQs: edit, hide, reorder, add, remove. */
export function ContentList<T extends Row>({ title, hint, items, fields, max, addLabel, blank, onChange }: Props<T>) {
  const patch = (i: number, p: Partial<T>) => onChange(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <section className={`${card} p-4 md:p-5`} aria-label={title}>
      <h3 className="text-[15px] font-bold text-ink">{title}</h3>
      <p className="text-[13px] text-muted">{hint}</p>
      <ol className="mt-3 space-y-3">
        {items.map((it, i) => (
          <li key={i} className={`rounded-lg border border-line p-3 ${it.hidden ? 'bg-subtle opacity-70' : 'bg-surface'}`}>
            <div className="mb-2 flex items-center gap-1">
              <span className="num flex-1 text-[13px] font-semibold text-muted">
                {i + 1}. {it.hidden ? t('Disembunyikan') : t('Tampil')}
              </span>
              <button type="button" className={btnIcon} onClick={() => onChange(move(items, i, -1))} disabled={i === 0} aria-label={t('Naikkan')}>
                <ArrowUp aria-hidden size={18} />
              </button>
              <button type="button" className={btnIcon} onClick={() => onChange(move(items, i, 1))} disabled={i === items.length - 1} aria-label={t('Turunkan')}>
                <ArrowDown aria-hidden size={18} />
              </button>
              <button type="button" className={btnIcon} onClick={() => patch(i, { hidden: !it.hidden } as Partial<T>)} aria-label={it.hidden ? t('Tampilkan') : t('Sembunyikan')} aria-pressed={it.hidden}>
                {it.hidden ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
              </button>
              <button type="button" className={btnIcon} onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={t('Hapus')}>
                <Trash2 aria-hidden size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((f) => {
                const id = `${title}-${i}-${f.key}`;
                const raw = (it as Record<string, unknown>)[f.key];
                const v = typeof raw === 'string' ? raw : '';
                return (
                  <div key={f.key}>
                    <label className={labelBase} htmlFor={id}>
                      {f.label} <span className="num font-normal text-muted">{t('{0}/{1}', v.length, f.max)}</span>
                    </label>
                    {f.isLong ? (
                      <textarea id={id} className={`${inputBase} h-auto min-h-24 py-2.5`} rows={3} maxLength={f.max} value={v} onChange={(e) => patch(i, { [f.key]: e.target.value } as Partial<T>)} />
                    ) : (
                      <input id={id} className={inputBase} maxLength={f.max} value={v} onChange={(e) => patch(i, { [f.key]: e.target.value } as Partial<T>)} />
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {items.length < max && (
        <button type="button" className={`${btnSecondary} mt-3`} onClick={() => onChange([...items, blank()])}>
          <Plus aria-hidden size={18} />
          {addLabel}
        </button>
      )}
    </section>
  );
}

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { badgeNeutral, btnIcon, btnPrimary, btnSecondary, inputBase, labelBase } from '../components/ui/styles';
import { t } from '../i18n';
import { rowComplete } from './editing';

/** Read-only rows that open one at a time for editing (ADR-024). Used by Konten landing. */

export interface Field {
  key: string;
  label: string;
  max: number;
  isLong?: boolean;
  /** Line breaks allowed (FAQ answers only; the server refuses them elsewhere). */
  isMultiline?: boolean;
  isOptional?: boolean;
  placeholder?: string;
}
export type Values = Record<string, string>;

const valueOf = (row: object, key: string) => {
  const v = (row as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
};
export const pick = (row: object, fields: readonly Field[]): Values => Object.fromEntries(fields.map((f) => [f.key, valueOf(row, f.key)]));

interface EditorProps {
  idPrefix: string;
  fields: readonly Field[];
  values: Values;
  notice: string | null;
  onChange: (v: Values) => void;
  onDone: () => void;
  onCancel: () => void;
}

/** The open row: only its own fields, Selesai keeps them in the page draft, Batal drops them. */
export function RowEditor({ idPrefix, fields, values, notice, onChange, onDone, onCancel }: EditorProps) {
  const required = fields.filter((f) => !f.isOptional).map((f) => f.key);
  const isComplete = rowComplete(values, required);
  return (
    <div
      className="space-y-3 rounded-lg border-2 border-brand-600 bg-surface p-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      {fields.map((f, i) => {
        const id = `${idPrefix}-${f.key}`;
        const v = values[f.key] ?? '';
        const set = (x: string) => onChange({ ...values, [f.key]: f.isMultiline ? x : x.replace(/\n/g, ' ') });
        return (
          <div key={f.key}>
            <label className={labelBase} htmlFor={id}>
              {f.label} {f.isOptional && <span className="font-normal text-muted">{t('(opsional)')}</span>} <span className="num font-normal text-muted">{t('{0}/{1}', v.length, f.max)}</span>
            </label>
            {f.isLong ? (
              <textarea id={id} autoFocus={i === 0} className={`${inputBase} h-auto min-h-24 py-2.5`} rows={3} maxLength={f.max} value={v} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
            ) : (
              <input id={id} autoFocus={i === 0} className={inputBase} maxLength={f.max} value={v} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
            )}
          </div>
        );
      })}
      {(notice || !isComplete) && (
        <p role={notice ? 'alert' : undefined} className={`text-[13px] ${notice ? 'font-semibold text-warn-700' : 'text-muted'}`}>
          {notice ?? t('Isi semua kolom yang wajib.')}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className={`${btnPrimary} flex-1`} disabled={!isComplete} onClick={onDone}>
          <Check aria-hidden size={18} />
          {t('Selesai')}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel}>
          {t('Batal')}
        </button>
      </div>
    </div>
  );
}

type Row = { hidden: boolean };
interface RowsProps {
  name: string;
  items: readonly Row[];
  fields: readonly Field[];
  max: number;
  addLabel: string;
  /** Index of the open row in this list, or null. */
  openIndex: number | null;
  /** Another row (here or in another sub-section) is open: other row actions wait. */
  isLocked: boolean;
  editor: (index: number) => ReactNode;
  onOpen: (index: number) => void;
  onAdd: () => void;
  onMove: (index: number, by: -1 | 1) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}

export function ContentRows({ name, items, fields, max, addLabel, openIndex, isLocked, editor, onOpen, onAdd, onMove, onToggle, onDelete }: RowsProps) {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [first, second] = fields;
  return (
    <div>
      {items.length === 0 && <p className="rounded-lg border border-dashed border-line-strong p-4 text-[14px] text-muted">{t('Belum ada isi.')}</p>}
      <ol className="space-y-2">
        {items.map((it, i) => {
          if (openIndex === i) return <li key={i}>{editor(i)}</li>;
          const title = first ? valueOf(it, first.key) : '';
          const sub = second ? valueOf(it, second.key) : '';
          return (
            <li key={i} className={`flex items-start gap-1 rounded-lg border border-line p-1 ${it.hidden ? 'bg-subtle' : 'bg-surface'}`}>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onOpen(i)}
                aria-label={t('Ubah {0} {1}: {2}', name, i + 1, title)}
                className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <span className="num w-5 shrink-0 pt-0.5 text-[13px] font-semibold text-muted">{i + 1}</span>
                <span className={`min-w-0 flex-1 ${it.hidden ? 'opacity-60' : ''}`}>
                  <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
                  {sub && <span className="line-clamp-2 text-[13px] text-muted">{sub}</span>}
                </span>
                {it.hidden && <span className={`${badgeNeutral} shrink-0`}>{t('Disembunyikan')}</span>}
                <Pencil aria-hidden size={16} className="mt-1 shrink-0 text-faint" />
              </button>
              {confirmDelete === i ? (
                <div className="flex shrink-0 items-center gap-1 p-1">
                  <span className="hidden text-[13px] font-semibold text-danger-700 sm:inline">{t('Hapus?')}</span>
                  <button type="button" className={`${btnIcon} text-danger-700`} aria-label={t('Ya, hapus')} onClick={() => (setConfirmDelete(null), onDelete(i))}>
                    <Check aria-hidden size={18} />
                  </button>
                  <button type="button" className={btnIcon} aria-label={t('Batal')} onClick={() => setConfirmDelete(null)}>
                    <X aria-hidden size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 flex-wrap justify-end gap-1 p-1">
                  <button type="button" className={btnIcon} disabled={isLocked || i === 0} onClick={() => onMove(i, -1)} aria-label={t('Naikkan')}>
                    <ArrowUp aria-hidden size={18} />
                  </button>
                  <button type="button" className={btnIcon} disabled={isLocked || i === items.length - 1} onClick={() => onMove(i, 1)} aria-label={t('Turunkan')}>
                    <ArrowDown aria-hidden size={18} />
                  </button>
                  <button type="button" className={btnIcon} disabled={isLocked} onClick={() => onToggle(i)} aria-label={it.hidden ? t('Tampilkan') : t('Sembunyikan')} aria-pressed={it.hidden}>
                    {it.hidden ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
                  </button>
                  <button type="button" className={btnIcon} disabled={isLocked} onClick={() => setConfirmDelete(i)} aria-label={t('Hapus')}>
                    <Trash2 aria-hidden size={18} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {items.length < max && (
        <button type="button" className={`${btnSecondary} mt-3`} disabled={isLocked} onClick={onAdd}>
          <Plus aria-hidden size={18} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

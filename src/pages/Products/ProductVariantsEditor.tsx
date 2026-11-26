import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RupiahInput } from '../../components/ui/RupiahInput';
import { btnIcon, inputBase, labelBase, option } from '../../components/ui/styles';
import { t } from '../../i18n';
import { uuidv7 } from '../../lib/id';
import { MAX_VARIANTS, VARIANT_NAME_MAX } from '../../lib/productVariants';
import type { Id, ProductVariant, SalesMode } from '../../types';

interface ProductVariantsEditorProps {
  variants: ProductVariant[];
  /** Sales modes priced "per product" (e.g. Takeaway): each variant gets its own optional price for them. */
  priceModes: readonly SalesMode[];
  /** "/kg" etc. when the product is sold by weight. */
  unitSuffix: string;
  onChange: (variants: ProductVariant[]) => void;
}

export const newVariant = (sortOrder: number, name = ''): ProductVariant => ({ id: uuidv7(), name, price: 0, sortOrder });

/** One tap fills the names of a fresh list; prices stay for the seller to type. */
const PRESETS: readonly (readonly string[])[] = [
  [t('Panas'), t('Dingin')],
  [t('Kecil'), t('Sedang'), t('Besar')],
  [t('Original'), t('Pedas')],
  [t('Biasa'), t('Spesial')],
];

/**
 * Variants of one product (ADR-012) as quick rows: name + own price on one line.
 * Enter in a price moves to the next row (or adds one); Takeaway price, cost and order sit behind "Detail".
 */
export function ProductVariantsEditor({ variants, priceModes, unitSuffix, onChange }: ProductVariantsEditorProps) {
  const [openDetail, setOpenDetail] = useState<ReadonlySet<Id>>(new Set());
  const [focusId, setFocusId] = useState<Id | null>(null);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`variant-name-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const patch = (id: Id, change: Partial<ProductVariant>) => onChange(variants.map((v) => (v.id === id ? { ...v, ...change } : v)));

  const setModePrice = (variant: ProductVariant, modeId: Id, price: number | null) => {
    const { [modeId]: _removed, ...rest } = variant.modePrices ?? {};
    patch(variant.id, { modePrices: price === null ? rest : { ...rest, [modeId]: price } });
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...variants];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index + direction, 0, moved);
    onChange(next.map((v, sortOrder) => ({ ...v, sortOrder })));
  };

  const add = () => {
    if (variants.length >= MAX_VARIANTS) return;
    const variant = newVariant(variants.length);
    onChange([...variants, variant]);
    setFocusId(variant.id);
  };

  const next = (index: number) => {
    const following = variants[index + 1];
    if (following) setFocusId(following.id);
    else add();
  };

  const applyPreset = (names: readonly string[]) => {
    const filled = names.map((name, i) => {
      const existing = variants[i];
      return existing ? { ...existing, name, sortOrder: i } : newVariant(i, name);
    });
    onChange([...filled, ...variants.slice(names.length).map((v, i) => ({ ...v, sortOrder: names.length + i }))]);
  };

  const toggleDetail = (id: Id) =>
    setOpenDetail((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });

  const isFresh = variants.every((v) => v.name.trim() === '');

  return (
    <div className="flex flex-col gap-2">
      {isFresh && (
        <div className="mb-1">
          <p className="mb-1.5 text-[13px] text-muted">{t('Isi cepat:')}</p>
          <div className="scroll-x -mx-1 flex gap-2 px-1 pb-1">
            {PRESETS.map((names) => (
              <button key={names.join()} type="button" onClick={() => applyPreset(names)} className={`${option(false)} min-h-10 shrink-0 whitespace-nowrap text-[13px]`}>
                {names.join(' · ')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div aria-hidden className="grid grid-cols-[1fr_8.5rem_2.75rem] gap-2 px-0.5 text-[12px] font-semibold text-muted sm:grid-cols-[1fr_10rem_2.75rem]">
        <span>{t('Nama varian')}</span>
        <span>
          {t('Harga')} <span className="num normal-case tracking-normal">{unitSuffix}</span>
        </span>
      </div>

      <ol className="flex flex-col gap-2">
        {variants.map((variant, index) => {
          const isOpen = openDetail.has(variant.id);
          const label = variant.name || String(index + 1);
          const hasExtra = variant.costPrice !== undefined || Object.keys(variant.modePrices ?? {}).length > 0;
          return (
            <li key={variant.id} className={`rounded-lg ${isOpen ? 'bg-subtle/70 p-2 ring-1 ring-line' : ''}`}>
              <div className="grid grid-cols-[1fr_8.5rem_2.75rem] items-center gap-2 sm:grid-cols-[1fr_10rem_2.75rem]">
                <input
                  id={`variant-name-${variant.id}`}
                  aria-label={t('Nama varian {0}', index + 1)}
                  value={variant.name}
                  maxLength={VARIANT_NAME_MAX}
                  autoComplete="off"
                  enterKeyHint="next"
                  placeholder={t('mis. Latte')}
                  onChange={(e) => patch(variant.id, { name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById(`variant-price-${variant.id}`)?.focus();
                    }
                  }}
                  className={`${inputBase} min-w-0`}
                />
                <RupiahInput
                  id={`variant-price-${variant.id}`}
                  ariaLabel={t('Harga {0}', label)}
                  value={variant.price || null}
                  enterKeyHint="next"
                  onEnter={() => next(index)}
                  onChange={(v) => patch(variant.id, { price: v ?? 0 })}
                />
                <button type="button" aria-label={t('Hapus varian {0}', label)} disabled={variants.length <= 1} onClick={() => onChange(variants.filter((v) => v.id !== variant.id))} className={`${btnIcon} border-transparent!`}>
                  <Trash2 aria-hidden size={17} className="text-danger-600" />
                </button>
              </div>

              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleDetail(variant.id)}
                className="mt-0.5 inline-flex h-9 items-center gap-1 rounded-md px-1 text-[13px] font-semibold text-muted hover:text-ink"
              >
                <ChevronDown aria-hidden size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                {hasExtra && !isOpen ? t('Detail (sudah diisi)') : t('Detail: harga lain, modal, urutan')}
              </button>

              {isOpen && (
                <div className="mt-1 grid gap-3 sm:grid-cols-2">
                  {priceModes.map((mode) => (
                    <div key={mode.id}>
                      <label htmlFor={`variant-${mode.id}-${variant.id}`} className={labelBase}>{t('Harga')} {mode.name}</label>
                      <RupiahInput id={`variant-${mode.id}-${variant.id}`} value={variant.modePrices?.[mode.id] ?? null} onChange={(v) => setModePrice(variant, mode.id, v)} placeholder={t('Ikut harga varian')} />
                    </div>
                  ))}
                  <div>
                    <label htmlFor={`variant-cost-${variant.id}`} className={labelBase}>{t('Harga modal')} <span className="font-normal text-muted">{t('(opsional)')}</span></label>
                    <RupiahInput id={`variant-cost-${variant.id}`} value={variant.costPrice ?? null} onChange={(v) => patch(variant.id, { costPrice: v ?? undefined })} placeholder={t('Belum diisi')} />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="button" aria-label={t('Naikkan {0}', label)} disabled={index === 0} onClick={() => move(index, -1)} className={btnIcon}>
                      <ArrowUp aria-hidden size={17} />
                    </button>
                    <button type="button" aria-label={t('Turunkan {0}', label)} disabled={index === variants.length - 1} onClick={() => move(index, 1)} className={btnIcon}>
                      <ArrowDown aria-hidden size={17} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={variants.length >= MAX_VARIANTS}
        onClick={add}
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-[14px] font-semibold text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-50 disabled:opacity-45"
      >
        <Plus aria-hidden size={17} /> {t('Tambah varian')}
      </button>
    </div>
  );
}

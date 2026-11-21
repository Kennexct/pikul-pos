import { ArrowDown, ArrowUp, ChevronRight, Tags } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { card } from '../../components/ui/styles';
import { moveCategory } from '../../services/categories';
import type { Category, Id } from '../../types';
import { t } from '../../i18n';

interface CategoriesPanelProps {
  storeId: Id;
  categories: readonly Category[];
  productCount: ReadonlyMap<Id | null, number>;
  onEdit: (category: Category) => void;
}

const moveBtn =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-subtle active:bg-line disabled:opacity-30 disabled:hover:bg-transparent';

/** Kategori tab: the category list in cashier order, with product counts (ADR-017). */
export function CategoriesPanel({ storeId, categories, productCount, onEdit }: CategoriesPanelProps) {
  const move = (id: Id, direction: -1 | 1) =>
    void moveCategory(storeId, id, direction).catch((error: unknown) => toast.error(error instanceof Error ? error.message : t('Terjadi kesalahan.')));
  const uncategorised = productCount.get(null) ?? 0;

  return (
    <div className={`${card} overflow-hidden`}>
      <ul className="divide-y divide-line">
        {categories.map((c, index) => (
          <li key={c.id} className="flex items-center gap-1 pr-2">
            <button type="button" onClick={() => onEdit(c)} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 text-left hover:bg-subtle">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{c.name}</span>
                <span className="num block text-[13px] text-muted">{t('{0} produk', productCount.get(c.id) ?? 0)}</span>
              </span>
              <ChevronRight aria-hidden size={18} className="shrink-0 text-faint" />
            </button>
            <button type="button" aria-label={t('Naikkan {0}', c.name)} disabled={index === 0} onClick={() => move(c.id, -1)} className={moveBtn}>
              <ArrowUp aria-hidden size={18} />
            </button>
            <button type="button" aria-label={t('Turunkan {0}', c.name)} disabled={index === categories.length - 1} onClick={() => move(c.id, 1)} className={moveBtn}>
              <ArrowDown aria-hidden size={18} />
            </button>
          </li>
        ))}
      </ul>
      {categories.length === 0 && <EmptyState icon={Tags} title={t('Belum ada kategori')} description={t('Kelompokkan menu, misalnya Makanan dan Minuman, supaya cepat dicari di kasir.')} />}
      {uncategorised > 0 && (
        <p className="num border-t border-line bg-subtle px-4 py-2.5 text-[13px] text-muted">{t('Tanpa kategori: {0} produk', uncategorised)}</p>
      )}
    </div>
  );
}

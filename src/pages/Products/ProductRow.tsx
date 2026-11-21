import { ChevronDown, ChevronRight } from 'lucide-react';
import { ProductThumb } from '../../components/ui/ProductThumb';
import { badgeBrand, badgeNeutral, badgeWarn } from '../../components/ui/styles';
import { formatRupiah } from '../../lib/money';
import { activeVariants } from '../../lib/productVariants';
import { perUnit } from '../../lib/quantity';
import type { Id, Product } from '../../types';
import { t } from '../../i18n';

/** Desktop columns shared by the header, product rows and variant lines. */
export const PRODUCT_COLUMNS = 'lg:grid-cols-[1fr_160px_120px_120px_96px_24px]';

interface ProductRowProps {
  product: Product;
  categoryName: string;
  /** Variant and add-on names for the desktop column. */
  summary: string;
  addOnCount: number;
  takeawayModeId: Id | undefined;
  takeawayModeName: string;
  /** Reserve the toggle column (some product in the list has variants) so rows line up. */
  hasToggleColumn: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

const statusBadge = (isActive: boolean, isSoldOut: boolean) => (
  <span className={!isActive ? badgeNeutral : isSoldOut ? badgeWarn : badgeBrand}>{!isActive ? t('Nonaktif') : isSoldOut ? t('Habis') : t('Aktif')}</span>
);

/** One product in the list; products with variants get a toggle that shows each variant's prices inline (ADR-017). */
export function ProductRow({ product: p, categoryName, summary, addOnCount, takeawayModeId, takeawayModeName, hasToggleColumn, isExpanded, onToggle, onOpen }: ProductRowProps) {
  const variants = activeVariants(p);
  const panelId = `variants-${p.id}`;
  const takeaway = (prices: Record<Id, number> | undefined) =>
    takeawayModeId && prices?.[takeawayModeId] !== undefined ? formatRupiah(prices[takeawayModeId] ?? 0) : '—';

  return (
    <li>
      <div className={`flex items-stretch ${hasToggleColumn ? 'pl-1' : ''}`}>
        {hasToggleColumn &&
          (variants.length > 0 ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={panelId}
              aria-label={isExpanded ? t('Sembunyikan varian {0}', p.name) : t('Tampilkan varian {0}', p.name)}
              onClick={onToggle}
              className="flex w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-subtle"
            >
              <ChevronDown aria-hidden size={18} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
            </button>
          ) : (
            <span aria-hidden className="w-11 shrink-0" />
          ))}
        <button
          type="button"
          onClick={onOpen}
          className={`grid min-w-0 flex-1 grid-cols-[1fr_auto_20px] items-center gap-3 py-3 pr-4 text-left hover:bg-subtle ${PRODUCT_COLUMNS} lg:gap-4 ${hasToggleColumn ? 'pl-1' : 'pl-4'}`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <ProductThumb name={p.name} photoUrl={p.photoUrl} className="h-11 w-11 shrink-0 rounded-md border border-line" />
            <span className="min-w-0">
              <span className={`block truncate text-[15px] font-semibold ${p.isActive ? '' : 'text-muted'}`}>{p.name}</span>
              <span className="block truncate text-[13px] text-muted">
                {categoryName}
                <span className="lg:hidden">
                  {variants.length > 0 && t(' · {0} varian', variants.length)}
                  {addOnCount > 0 && t(' · {0} add-on', addOnCount)}
                  {p.isActive && p.isSoldOut && t(' · Habis')}
                </span>
              </span>
            </span>
          </span>
          <span className="hidden truncate text-[13px] text-ink-soft lg:block">{summary || '—'}</span>
          <span className="num text-right text-[15px] font-semibold">{formatRupiah(p.basePrice)}{perUnit(p.unit)}</span>
          <span className="num hidden text-right text-[14px] text-ink-soft lg:block">{takeaway(p.modePrices)}</span>
          <span className="hidden lg:block">{statusBadge(p.isActive, p.isSoldOut === true)}</span>
          <ChevronRight aria-hidden size={18} className="text-faint" />
        </button>
      </div>

      {isExpanded && variants.length > 0 && (
        <ul id={panelId} aria-label={t('Varian {0}', p.name)} className="animate-fade border-t border-dashed border-line bg-subtle/60 py-1">
          {variants.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={onOpen}
                className={`grid w-full grid-cols-[1fr_auto_20px] items-center gap-3 py-2 pl-[108px] pr-4 text-left hover:bg-subtle ${PRODUCT_COLUMNS} lg:gap-4`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{v.name}</span>
                  <span className="block truncate text-[12px] text-muted lg:hidden">
                    {takeawayModeId && v.modePrices?.[takeawayModeId] !== undefined && `${takeawayModeName} ${takeaway(v.modePrices)}`}
                    {p.isActive && v.isSoldOut && t(' · Habis')}
                  </span>
                </span>
                <span className="hidden lg:block" />
                <span className="num text-right text-[14px] font-semibold">{formatRupiah(v.price)}</span>
                <span className="num hidden text-right text-[13px] text-ink-soft lg:block">{takeaway(v.modePrices)}</span>
                <span className="hidden lg:block">{statusBadge(p.isActive, v.isSoldOut === true)}</span>
                <span aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

import { Layers, PackagePlus, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants';
import { btnPrimary } from '../../../components/ui/styles';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ProductThumb } from '../../../components/ui/ProductThumb';
import { formatRupiah } from '../../../lib/money';
import { isUsingFallbackPrice, resolveModePrice } from '../../../lib/pricing';
import type { Id, Product, SalesMode } from '../../../types';
import { t } from '../../../i18n';
import { perUnit } from '../../../lib/quantity';
import { fromPrice, hasVariants, isProductSoldOut } from '../../../lib/productVariants';

interface ProductGridProps {
  products: Product[];
  salesMode: SalesMode;
  qtyByProduct: ReadonlyMap<Id, number>;
  /** Called for sold-out products too; the page decides what a tap on one does. */
  onSelect: (product: Product) => void;
  /** The store has no sellable product at all (a new store starts with an empty menu, ADR-018). */
  isMenuEmpty?: boolean;
}

export function ProductGrid({ products, salesMode, qtyByProduct, onSelect, isMenuEmpty = false }: ProductGridProps) {
  if (isMenuEmpty) {
    return (
      <EmptyState
        icon={PackagePlus}
        title={t('Menu masih kosong')}
        description={t('Tambahkan produk yang Anda jual beserta harganya, lalu mulai mencatat penjualan.')}
        action={<Link to={ROUTES.products} className={btnPrimary}>{t('Tambah produk')}</Link>}
      />
    );
  }
  if (products.length === 0) {
    return <EmptyState icon={SearchX} title={t('Produk tidak ditemukan')} description={t('Coba kata kunci lain atau pilih kategori Semua.')} />;
  }

  return (
    <ul className="grid grid-cols-3 gap-2 md:gap-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => {
        const qty = qtyByProduct.get(product.id) ?? 0;
        const isSelected = qty > 0;
        const hasChoices = hasVariants(product) || product.variantGroupIds.length > 0;
        const isSoldOut = isProductSoldOut(product);
        return (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onSelect(product)}
              aria-label={isSoldOut ? t('{0}, habis', product.name) : undefined}
              className={`relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-surface text-left shadow-xs transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.985] ${
                isSelected ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line hover:border-line-strong'
              } ${isSoldOut ? 'bg-subtle! shadow-none!' : ''}`}
            >
              <ProductThumb name={product.name} photoUrl={product.photoUrl} className={`aspect-[3/2] w-full border-b border-line md:aspect-[4/3] ${isSoldOut ? 'opacity-40 grayscale' : ''}`} />
              <span className="flex flex-1 flex-col gap-1 p-2.5 md:p-3">
                <span className={`line-clamp-2 text-[13px] font-semibold leading-snug md:text-[14px] ${isSoldOut ? 'text-muted' : 'text-ink'}`}>{product.name}</span>
                <span className="mt-auto flex items-center gap-1.5">
                  <span className={`num text-[13px] font-semibold md:text-[14px] ${isSoldOut ? 'text-faint' : 'text-ink-soft'}`}>
                    {hasVariants(product) ? t('Mulai {0}', formatRupiah(fromPrice(product, salesMode))) : formatRupiah(resolveModePrice(product, salesMode))}
                    {perUnit(product.unit)}
                  </span>
                  {hasChoices && <Layers aria-label={t('Ada pilihan')} size={14} className="text-faint" />}
                  {!hasVariants(product) && isUsingFallbackPrice(product, salesMode) && (
                    <span title={t('Harga mode ini belum diatur — memakai harga dasar')} className="h-[18px] rounded bg-warn-50 px-1 text-[10px] font-semibold leading-[18px] text-warn-700">
                      {t('Dasar')}
                    </span>
                  )}
                </span>
              </span>
              {isSoldOut && (
                <span className="absolute left-1.5 top-1.5 flex h-6 items-center rounded-md bg-danger-600 px-2 text-[12px] font-semibold text-white">{t('Habis')}</span>
              )}
              {isSelected && (
                <span key={qty} className="num animate-pop absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-brand-600 px-1.5 text-[13px] font-bold text-white shadow-xs">
                  {qty}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

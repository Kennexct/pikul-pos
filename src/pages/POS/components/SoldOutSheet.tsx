import { SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Sheet } from '../../../components/ui/Sheet';
import { Switch } from '../../../components/ui/Switch';
import { activeVariants, hasVariants, isProductSoldOut } from '../../../lib/productVariants';
import { matchProduct } from '../../../lib/productSearch';
import { setProductSoldOut, setVariantSoldOut } from '../../../services/catalog';
import type { Product } from '../../../types';
import { t } from '../../../i18n';

interface SoldOutSheetProps {
  /** Products shown at the cashier (active ones). */
  products: readonly Product[];
  onClose: () => void;
}

/** Any seller marks what has run out; the tile stays visible but cannot be sold until switched back. */
export function SoldOutSheet({ products, onClose }: SoldOutSheetProps) {
  const [query, setQuery] = useState('');
  const soldOutCount = products.filter(isProductSoldOut).length;

  /** Items that were sold out when the sheet opened go first; the order then stays put so rows do not jump under the finger. */
  const [pinnedIds] = useState(() => new Set(products.filter((p) => p.isSoldOut || (p.variants ?? []).some((v) => v.isSoldOut)).map((p) => p.id)));
  const rows = useMemo(() => {
    const matches = products.filter((p) => matchProduct(p, query) !== null);
    return [...matches.filter((p) => pinnedIds.has(p.id)), ...matches.filter((p) => !pinnedIds.has(p.id))];
  }, [products, query, pinnedIds]);

  const toggleVariant = async (product: Product, variantId: string, isSoldOut: boolean) => {
    try {
      await setVariantSoldOut(product.id, variantId, isSoldOut);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan.'));
    }
  };

  const toggle = async (product: Product, isSoldOut: boolean) => {
    try {
      await setProductSoldOut(product.id, isSoldOut);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan.'));
    }
  };

  return (
    <Sheet title={t('Stok habis')} subtitle={soldOutCount > 0 ? t('{0} menu ditandai habis', soldOutCount) : t('Semua menu tersedia')} isOpen onClose={onClose} isFlush>
      <div className="border-b border-line px-5 py-3">
        <SearchInput value={query} onChange={setQuery} placeholder={t('Cari menu…')} label={t('Cari menu untuk ditandai habis')} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-1">
        {rows.length === 0 ? (
          <EmptyState icon={SearchX} title={t('Menu tidak ditemukan')} description={t('Coba kata kunci lain.')} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((product) => (
              <li key={product.id} className="py-1">
                {hasVariants(product) ? (
                  <>
                    <p className="pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{product.name}</p>
                    {activeVariants(product).map((variant) => (
                      <div key={variant.id} className="pl-3">
                        <Switch
                          tone="danger"
                          checked={variant.isSoldOut === true}
                          onChange={(isSoldOut) => void toggleVariant(product, variant.id, isSoldOut)}
                          label={variant.name}
                          description={variant.isSoldOut ? t('Habis, tidak bisa dijual') : undefined}
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  <Switch
                    tone="danger"
                    checked={product.isSoldOut === true}
                    onChange={(isSoldOut) => void toggle(product, isSoldOut)}
                    label={product.name}
                    description={product.isSoldOut ? t('Habis, tidak bisa dijual') : undefined}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

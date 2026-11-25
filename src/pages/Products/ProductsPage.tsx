import { ChevronRight, ChevronsDownUp, ChevronsUpDown, PackageOpen, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/Layout/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { SearchInput } from '../../components/ui/SearchInput';
import { badgeNeutral, btnGhost, btnPrimary, card } from '../../components/ui/styles';
import { Tabs } from '../../components/ui/Tabs';
import { useAppData } from '../../hooks/useAppData';
import { formatRupiah } from '../../lib/money';
import { hasVariants } from '../../lib/productVariants';
import { searchProducts } from '../../lib/productSearch';
import type { Category, Id, Product, VariantGroup } from '../../types';
import { CategoriesPanel } from './CategoriesPanel';
import { CategoryForm } from './CategoryForm';
import { ProductForm } from './ProductForm';
import { PRODUCT_COLUMNS, ProductRow } from './ProductRow';
import { VariantGroupForm } from './VariantGroupForm';
import { t } from '../../i18n';

type Tab = 'products' | 'variants' | 'categories';
type Editing<T> = { item: T | null } | null;

export function ProductsPage() {
  const { store, catalog } = useAppData();
  const [tab, setTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Editing<Product>>(null);
  const [editingGroup, setEditingGroup] = useState<Editing<VariantGroup>>(null);
  const [editingCategory, setEditingCategory] = useState<Editing<Category>>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<Id>>(new Set());

  const categoryName = useMemo(() => new Map(catalog?.categories.map((c) => [c.id, c.name]) ?? []), [catalog]);
  const groupName = useMemo(() => new Map(catalog?.variantGroups.map((g) => [g.id, g.name]) ?? []), [catalog]);
  /** Products per category; key null = "Tanpa kategori" (also products whose category was deleted). */
  const productCount = useMemo(() => {
    const counts = new Map<Id | null, number>();
    for (const p of catalog?.products ?? []) {
      const key = p.categoryId && categoryName.has(p.categoryId) ? p.categoryId : null;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [catalog, categoryName]);

  if (!store || !catalog) return <LoadingScreen />;

  /** Search matches product and variant names; rows found through a variant open with that variant marked. */
  const matches = searchProducts(catalog.products, search);
  const products = catalog.products.filter((p) => matches.has(p.id));
  const takeawayMode = catalog.salesModes.find((m) => m.priceRule === 'mode_price');
  const withVariants = products.filter(hasVariants);
  const isAllExpanded = withVariants.length > 0 && withVariants.every((p) => expanded.has(p.id));
  const toggle = (id: Id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const addNew = () => {
    if (tab === 'products') setEditingProduct({ item: null });
    else if (tab === 'variants') setEditingGroup({ item: null });
    else setEditingCategory({ item: null });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('Produk')}
        helpTopic="produk"
        description={t('Menu, harga per mode penjualan, varian, dan add-on.')}
        actions={
          <button
            type="button"
            onClick={addNew}
            className={`${btnPrimary} h-11`}
          >
            <Plus aria-hidden size={18} /> {tab === 'products' ? t('Produk') : tab === 'variants' ? t('Grup add-on') : t('Kategori')}
          </button>
        }
      >
        <Tabs
          label={t('Jenis data')}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'products', label: t('Produk'), count: catalog.products.length },
            { value: 'variants', label: t('Add-on'), count: catalog.variantGroups.length },
            { value: 'categories', label: t('Kategori'), count: catalog.categories.length },
          ]}
        />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        {tab === 'products' ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <div className="min-w-0 max-w-md flex-1">
                <SearchInput value={search} onChange={setSearch} placeholder={t('Cari produk atau varian…')} label={t('Cari produk')} />
              </div>
              {withVariants.length > 0 && (
                <button
                  type="button"
                  aria-label={isAllExpanded ? t('Tutup semua varian') : t('Buka semua varian')}
                  onClick={() => setExpanded(isAllExpanded ? new Set() : new Set(withVariants.map((p) => p.id)))} className={`${btnGhost} shrink-0 text-[14px]`}>
                  {isAllExpanded ? <ChevronsDownUp aria-hidden size={17} /> : <ChevronsUpDown aria-hidden size={17} />}
                  <span className="hidden sm:inline">{isAllExpanded ? t('Tutup semua varian') : t('Buka semua varian')}</span>
                </button>
              )}
            </div>
            <div className={`${card} overflow-hidden`}>
              <div
                className={`hidden items-center gap-4 border-b border-line bg-subtle py-2.5 pr-4 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted @4xl/page:grid ${PRODUCT_COLUMNS} ${withVariants.length > 0 ? 'pl-[52px]' : 'pl-4'}`}
              >
                <span>{t('Produk')}</span>
                <span>{t('Varian & add-on')}</span>
                <span className="text-right">{'Dine In'}</span>
                <span className="text-right">{takeawayMode?.name ?? 'Takeaway'}</span>
                <span>{t('Status')}</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    categoryName={(p.categoryId && categoryName.get(p.categoryId)) || t('Tanpa kategori')}
                    summary={[(p.variants ?? []).map((v) => v.name).join(', '), p.variantGroupIds.map((id) => groupName.get(id)).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    addOnCount={p.variantGroupIds.length}
                    takeawayModeId={takeawayMode?.id}
                    takeawayModeName={takeawayMode?.name ?? 'Takeaway'}
                    hasToggleColumn={withVariants.length > 0}
                    isExpanded={expanded.has(p.id) || (matches.get(p.id)?.length ?? 0) > 0}
                    matchedVariants={matches.get(p.id)}
                    onToggle={() => toggle(p.id)}
                    onOpen={() => setEditingProduct({ item: p })}
                  />
                ))}
              </ul>
              {products.length === 0 && <EmptyState icon={PackageOpen} title={t('Belum ada produk')} description={t('Tambahkan menu pertama Anda.')} />}
            </div>
          </>
        ) : tab === 'categories' ? (
          <CategoriesPanel storeId={store.id} categories={catalog.categories} productCount={productCount} onEdit={(category) => setEditingCategory({ item: category })} />
        ) : (
          <ul className={`${card} divide-y divide-line overflow-hidden`}>
            {catalog.variantGroups.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => setEditingGroup({ item: g })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-subtle">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold">{g.name}</span>
                      <span className={badgeNeutral}>{g.isRequired ? t('Wajib') : t('Opsional')}</span>
                      <span className={badgeNeutral}>{g.selectType === 'single' ? t('Pilih satu') : t('Maks {0}', g.max)}</span>
                    </span>
                    <span className="num mt-0.5 block truncate text-[13px] text-muted">
                      {g.options.map((o) => (o.priceDelta ? `${o.name} +${formatRupiah(o.priceDelta)}` : o.name)).join(' · ')}
                    </span>
                  </span>
                  <ChevronRight aria-hidden size={18} className="text-faint" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingProduct && <ProductForm product={editingProduct.item} catalog={catalog} storeId={store.id} isWeightSaleEnabled={store.settings.isWeightSaleEnabled === true} onClose={() => setEditingProduct(null)} />}
      {editingCategory && (
        <CategoryForm
          category={editingCategory.item}
          storeId={store.id}
          productCount={editingCategory.item ? (productCount.get(editingCategory.item.id) ?? 0) : 0}
          onClose={() => setEditingCategory(null)}
        />
      )}
      {editingGroup && <VariantGroupForm group={editingGroup.item} storeId={store.id} onClose={() => setEditingGroup(null)} />}
    </section>
  );
}

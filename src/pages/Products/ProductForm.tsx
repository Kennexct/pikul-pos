import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Sheet } from '../../components/ui/Sheet';
import { btnPrimary, btnSecondary } from '../../components/ui/styles';
import type { Catalog } from '../../hooks/useCatalog';
import { t } from '../../i18n';
import { formatRupiah } from '../../lib/money';
import { isMeasured, perUnit } from '../../lib/quantity';
import { newMeta, saveProduct } from '../../services/catalog';
import { createCategory } from '../../services/categories';
import type { Id, Product, ProductVariant } from '../../types';
import { ProductBasics, ProductPhotoInput, ProductPreview } from './ProductBasics';
import { ProductMoreOptions } from './ProductMoreOptions';
import { ProductPricing, type PriceKind } from './ProductPricing';
import { newVariant } from './ProductVariantsEditor';

interface ProductFormProps {
  product: Product | null;
  catalog: Catalog;
  storeId: Id;
  /** Store setting: show "Dijual per" (ADR-011). */
  isWeightSaleEnabled: boolean;
  onClose: () => void;
}

const newProduct = (storeId: Id, sortOrder: number, categoryId: Id | null = null): Product => ({
  ...newMeta(storeId),
  categoryId,
  name: '',
  basePrice: 0,
  isActive: true,
  sortOrder,
  variantGroupIds: [],
  modePrices: {},
});

/** A row left untouched (no name, no price, nothing else): dropped on save so Enter-to-add never blocks saving. */
const isBlankVariant = (v: ProductVariant) => v.name.trim() === '' && v.price === 0 && v.costPrice === undefined && Object.keys(v.modePrices ?? {}).length === 0;

/**
 * M2 + M3: product with category, price or variants (ADR-012), per-mode prices, add-ons and photo.
 * Built for speed: name is focused on open, Enter walks the fields, a category typed but not yet added is created on save,
 * and "Simpan & tambah lagi" starts the next product in the same category.
 */
export function ProductForm({ product, catalog, storeId, onClose, isWeightSaleEnabled }: ProductFormProps) {
  const [draft, setDraft] = useState<Product>(() => product ?? newProduct(storeId, catalog.products.length));
  const [priceKind, setPriceKind] = useState<PriceKind>(() => ((product?.variants?.length ?? 0) > 0 ? 'variants' : 'single'));
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** Bumps after "Simpan & tambah lagi" so the form remounts fresh (focus back on the name). */
  const [round, setRound] = useState(0);
  const [added, setAdded] = useState(0);
  /** Variants kept while the seller flips to "Satu harga" and back. */
  const stashedVariants = useRef<ProductVariant[]>([]);

  const update = (patch: Partial<Product>) => setDraft((prev) => ({ ...prev, ...patch }));

  const changePriceKind = (kind: PriceKind) => {
    if (kind === priceKind) return;
    if (kind === 'variants') {
      const stash = stashedVariants.current;
      update({ variants: stash.length > 0 ? stash : [newVariant(0), newVariant(1)] });
    } else {
      stashedVariants.current = draft.variants ?? [];
      update({ variants: [] });
    }
    setPriceKind(kind);
  };

  /** Creates the typed category (or picks the existing one with that name) and returns its id. */
  const resolvePendingCategory = async (): Promise<Id | null | undefined> => {
    const name = pendingCategory?.trim().replace(/\s+/g, ' ') ?? '';
    if (name === '') return undefined;
    const existing = catalog.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const id = existing ? existing.id : (await createCategory(name, storeId)).id;
    update({ categoryId: id });
    setPendingCategory(null);
    return id;
  };

  const handleAddCategory = async () => {
    try {
      if ((await resolvePendingCategory()) === undefined) setPendingCategory(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menambah kategori.'));
    }
  };

  const handleSave = async (isAddingAnother: boolean) => {
    setIsSaving(true);
    try {
      const categoryId = await resolvePendingCategory();
      const variants = priceKind === 'variants' ? (draft.variants ?? []).filter((v) => !isBlankVariant(v)) : [];
      if (priceKind === 'variants' && variants.length === 0) throw new Error(t('Isi nama dan harga minimal satu varian.'));
      const toSave: Product = { ...draft, variants, ...(categoryId === undefined ? {} : { categoryId }) };
      await saveProduct(toSave);
      toast.success(t('{0} disimpan', toSave.name.trim()));
      if (isAddingAnother) {
        setAdded((n) => n + 1);
        setDraft(newProduct(storeId, catalog.products.length + added + 1, toSave.categoryId));
        setPriceKind('single');
        stashedVariants.current = [];
        setRound((r) => r + 1);
      } else {
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan produk.'));
    } finally {
      setIsSaving(false);
    }
  };

  const unit = draft.unit ?? 'pcs';
  const showsUnit = isWeightSaleEnabled || isMeasured(draft.unit);
  const variantPrices = (draft.variants ?? []).map((v) => v.price).filter((p) => p > 0);
  const priceLabel =
    priceKind === 'variants'
      ? variantPrices.length > 0
        ? t('Mulai {0}', formatRupiah(Math.min(...variantPrices)))
        : t('{0} varian', draft.variants?.length ?? 0)
      : `${formatRupiah(draft.basePrice)}${perUnit(unit)}`;

  const focusPrice = () => {
    const target = priceKind === 'variants' ? document.querySelector<HTMLInputElement>('[id^="variant-name-"]') : document.getElementById('base-price');
    target?.focus();
  };

  return (
    <Sheet
      title={product ? t('Ubah produk') : t('Produk baru')}
      subtitle={product ? product.name : added > 0 ? t('{0} produk ditambahkan', added) : t('Tambahkan menu ke kasir')}
      isOpen
      isWide
      onClose={onClose}
      footer={
        product ? (
          <button type="button" disabled={isSaving} onClick={() => void handleSave(false)} className={`${btnPrimary} w-full`}>
            {isSaving ? t('Menyimpan…') : t('Simpan produk')}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={isSaving} onClick={() => void handleSave(true)} className={`${btnSecondary} px-2! whitespace-nowrap text-[14px] sm:text-[15px]`}>
              {t('Simpan & tambah lagi')}
            </button>
            <button type="button" disabled={isSaving} onClick={() => void handleSave(false)} className={`${btnPrimary} px-2! whitespace-nowrap text-[14px] sm:text-[15px]`}>
              {isSaving ? t('Menyimpan…') : t('Simpan produk')}
            </button>
          </div>
        )
      }
    >
      <ProductPhotoInput update={update} />
      <div key={round} className="grid gap-6 md:grid-cols-[176px_1fr]">
        <ProductPreview draft={draft} update={update} priceLabel={priceLabel} />
        <div className="flex min-w-0 flex-col gap-5">
          <ProductBasics
            draft={draft}
            categories={catalog.categories}
            pendingCategory={pendingCategory}
            onPendingCategory={setPendingCategory}
            onAddCategory={() => void handleAddCategory()}
            update={update}
            isNew={product === null}
            onNameEnter={focusPrice}
          />
          <ProductPricing draft={draft} update={update} priceKind={priceKind} onPriceKind={changePriceKind} salesModes={catalog.salesModes} showsUnit={showsUnit} />
          <ProductMoreOptions draft={draft} update={update} variantGroups={catalog.variantGroups} />
        </div>
      </div>
    </Sheet>
  );
}

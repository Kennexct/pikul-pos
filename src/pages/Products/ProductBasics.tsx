import { Camera, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductThumb } from '../../components/ui/ProductThumb';
import { btnPrimary, inputBase, labelBase, option } from '../../components/ui/styles';
import { t } from '../../i18n';
import { compressProductPhoto } from '../../lib/image';
import type { Category, Id, Product } from '../../types';

interface PhotoPickerProps {
  draft: Product;
  className: string;
  thumbClass: string;
}

const PHOTO_INPUT_ID = 'product-photo-input';

/** The one hidden file input of the form; both photo buttons (phone and tablet layout) open it. */
export function ProductPhotoInput({ update }: { update: (patch: Partial<Product>) => void }) {
  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    const result = await compressProductPhoto(file);
    if (result.ok) update({ photoUrl: result.value });
    else toast.error(result.error);
  };
  return <input id={PHOTO_INPUT_ID} type="file" accept="image/*" hidden onChange={(e) => void handlePhoto(e.target.files?.[0])} />;
}

/** The product picture is the button: tap it to add or change the photo. */
function PhotoPicker({ draft, className, thumbClass }: PhotoPickerProps) {
  return (
    <button
      type="button"
      onClick={() => document.getElementById(PHOTO_INPUT_ID)?.click()}
      aria-label={draft.photoUrl ? t('Ganti foto') : t('Unggah foto')}
      className={`group relative block overflow-hidden ${className}`}
    >
      <ProductThumb name={draft.name || '?'} photoUrl={draft.photoUrl} className={thumbClass} />
      <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-md bg-surface/95 text-ink-soft shadow-xs ring-1 ring-line transition-colors group-hover:text-ink md:bottom-1.5 md:right-1.5 md:h-8 md:w-8">
        <Camera aria-hidden size={15} />
      </span>
    </button>
  );
}

interface ProductPreviewProps {
  draft: Product;
  update: (patch: Partial<Product>) => void;
  priceLabel: string;
}

/** Tablet only: the left column previews the tile as the cashier will see it. */
export function ProductPreview({ draft, update, priceLabel }: ProductPreviewProps) {
  return (
    <aside className="hidden md:block">
      <p className={labelBase}>{t('Tampilan di kasir')}</p>
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        <PhotoPicker draft={draft} className="w-full border-b border-line" thumbClass="aspect-[4/3] w-full" />
        <div className="p-3">
          <p className={`line-clamp-2 text-[14px] font-semibold leading-snug ${draft.name ? 'text-ink' : 'text-muted'}`}>{draft.name || t('Nama produk')}</p>
          <p className="num mt-1 text-[14px] font-semibold text-ink-soft">{priceLabel}</p>
        </div>
      </div>
      {draft.photoUrl ? (
        <button type="button" onClick={() => update({ photoUrl: undefined })} className="mt-2 h-10 w-full rounded-lg text-[13px] font-semibold text-danger-700 hover:bg-danger-50">
          {t('Hapus foto')}
        </button>
      ) : (
        <p className="mt-2 text-center text-[12px] text-muted">{t('Ketuk gambar untuk menambah foto')}</p>
      )}
    </aside>
  );
}

interface ProductBasicsProps {
  draft: Product;
  categories: readonly Category[];
  /** Name typed for a category that does not exist yet; null = the inline field is closed. */
  pendingCategory: string | null;
  onPendingCategory: (name: string | null) => void;
  onAddCategory: () => void;
  update: (patch: Partial<Product>) => void;
  /** Focus the name on open for a new product, so the keyboard is up straight away. */
  isNew: boolean;
  /** Enter in the name field moves on to the price. */
  onNameEnter: () => void;
}

/** Name, category (and the photo on a phone): the part of the product form every product needs. */
export function ProductBasics(props: ProductBasicsProps) {
  const { draft, categories, pendingCategory, onPendingCategory, onAddCategory, update, isNew, onNameEnter } = props;

  const selectCategory = (id: Id | null) => {
    update({ categoryId: id });
    onPendingCategory(null);
  };

  return (
    <div className="flex flex-col gap-5">
        <div className="flex items-end gap-3">
          <div className="shrink-0 md:hidden">
            <PhotoPicker draft={draft} className="h-[72px] w-[72px] rounded-lg border border-line" thumbClass="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="product-name" className={labelBase}>{t('Nama produk')}</label>
            <input
              id="product-name"
              value={draft.name}
              maxLength={80}
              autoFocus={isNew}
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => update({ name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onNameEnter();
                }
              }}
              placeholder={t('Contoh: Bakso Urat')}
              className={`${inputBase} h-14 text-[17px] font-semibold`}
            />
          </div>
        </div>
        {draft.photoUrl && (
          <button type="button" onClick={() => update({ photoUrl: undefined })} className="-mt-3 self-start text-[13px] font-semibold text-danger-700 md:hidden">
            {t('Hapus foto')}
          </button>
        )}

        <fieldset>
          <legend className={labelBase}>{t('Kategori')}</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={draft.categoryId === null && pendingCategory === null} onClick={() => selectCategory(null)} className={option(draft.categoryId === null && pendingCategory === null)}>
              {t('Tanpa kategori')}
            </button>
            {categories.map((c) => (
              <button key={c.id} type="button" aria-pressed={draft.categoryId === c.id && pendingCategory === null} onClick={() => selectCategory(c.id)} className={option(draft.categoryId === c.id && pendingCategory === null)}>
                {c.name}
              </button>
            ))}
            {pendingCategory === null && (
              <button type="button" onClick={() => onPendingCategory('')} className={`${option(false)} border-dashed text-brand-700!`}>
                <Plus aria-hidden size={16} /> {t('Kategori baru')}
              </button>
            )}
          </div>
          {pendingCategory !== null && (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                aria-label={t('Nama kategori baru')}
                value={pendingCategory}
                maxLength={80}
                enterKeyHint="done"
                placeholder={t('Nama kategori')}
                onChange={(e) => onPendingCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddCategory();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    onPendingCategory(null);
                  }
                }}
                className={inputBase}
              />
              <button type="button" onClick={onAddCategory} className={btnPrimary}>{t('Tambah')}</button>
              <button type="button" aria-label={t('Batal')} onClick={() => onPendingCategory(null)} className="flex h-12 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle">
                <X aria-hidden size={18} />
              </button>
            </div>
          )}
          {pendingCategory !== null && pendingCategory.trim() !== '' && (
            <p className="mt-1.5 text-[13px] text-muted">{t('Kategori ini ikut dibuat saat produk disimpan.')}</p>
          )}
        </fieldset>
    </div>
  );
}

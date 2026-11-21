import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Sheet } from '../../components/ui/Sheet';
import { btnDanger, btnDangerSolid, btnPrimary, btnSecondary, helperText, inputBase, labelBase } from '../../components/ui/styles';
import { createCategory, deleteCategory, renameCategory } from '../../services/categories';
import type { Category, Id } from '../../types';
import { t } from '../../i18n';

interface CategoryFormProps {
  category: Category | null;
  storeId: Id;
  productCount: number;
  onClose: () => void;
}

/** Add or rename a category; delete moves its products to "Tanpa kategori" (ADR-017). */
export function CategoryForm({ category, storeId, productCount, onClose }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const run = async (action: () => Promise<string>) => {
    setIsSaving(true);
    try {
      toast.success(await action());
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Terjadi kesalahan.'));
      setIsSaving(false);
    }
  };

  const save = () =>
    run(async () => {
      if (category) await renameCategory(category.id, name);
      else await createCategory(name, storeId);
      return t('{0} disimpan', name.trim());
    });

  const remove = () =>
    run(async () => {
      if (!category) return '';
      await deleteCategory(category.id);
      return t('Kategori {0} dihapus', category.name);
    });

  if (category && isConfirmingDelete) {
    return (
      <Sheet
        title={t('Hapus kategori?')}
        subtitle={category.name}
        isOpen
        onClose={() => setIsConfirmingDelete(false)}
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsConfirmingDelete(false)} className={btnSecondary}>{t('Batal')}</button>
            <button type="button" disabled={isSaving} onClick={() => void remove()} className={`${btnDangerSolid} flex-1`}>{t('Hapus kategori')}</button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-soft">
          {productCount > 0 ? t('{0} produk di kategori ini pindah ke "Tanpa kategori". Produknya tidak dihapus.', productCount) : t('Kategori ini tidak berisi produk.')}
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={category ? t('Ubah kategori') : t('Kategori baru')}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {category && (
            <button type="button" aria-label={t('Hapus kategori')} onClick={() => setIsConfirmingDelete(true)} className={btnDanger}>
              <Trash2 aria-hidden size={18} />
            </button>
          )}
          <button type="button" disabled={isSaving} onClick={() => void save()} className={`${btnPrimary} flex-1`}>{t('Simpan')}</button>
        </div>
      }
    >
      <label htmlFor="category-name" className={labelBase}>{t('Nama kategori')}</label>
      <input
        id="category-name"
        autoFocus
        value={name}
        maxLength={80}
        placeholder={t('mis. Minuman')}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
        className={inputBase}
      />
      <p className={helperText}>{t('Urutan kategori sama dengan tab di layar kasir.')}</p>
    </Sheet>
  );
}

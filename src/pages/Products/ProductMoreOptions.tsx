import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { labelBase, option } from '../../components/ui/styles';
import { Switch } from '../../components/ui/Switch';
import { t } from '../../i18n';
import type { Id, Product, VariantGroup } from '../../types';

interface ProductMoreOptionsProps {
  draft: Product;
  update: (patch: Partial<Product>) => void;
  variantGroups: readonly VariantGroup[];
}

/** Add-on chips, then the rarely changed switches folded under "Pengaturan lain" (open when one is not default). */
export function ProductMoreOptions({ draft, update, variantGroups }: ProductMoreOptionsProps) {
  const isNonDefault = draft.isPriceEditable === true || !draft.isActive || draft.isSoldOut === true;
  const [isOpen, setIsOpen] = useState(isNonDefault);

  const toggleGroup = (groupId: Id) =>
    update({
      variantGroupIds: draft.variantGroupIds.includes(groupId) ? draft.variantGroupIds.filter((id) => id !== groupId) : [...draft.variantGroupIds, groupId],
    });

  const summary = [
    draft.isActive ? t('Tampil di kasir') : t('Disembunyikan'),
    draft.isSoldOut ? t('Sedang habis') : null,
    draft.isPriceEditable ? t('Harga bisa diubah') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <fieldset>
        <legend className={labelBase}>
          {t('Add-on')} <span className="font-normal text-muted">{t('(opsional)')}</span>
        </legend>
        {variantGroups.length === 0 ? (
          <p className="text-[14px] text-muted">{t('Belum ada grup add-on. Buat di tab Add-on (mis. Es, Gula, Ukuran).')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {variantGroups.map((g) => {
              const isOn = draft.variantGroupIds.includes(g.id);
              return (
                <button key={g.id} type="button" aria-pressed={isOn} onClick={() => toggleGroup(g.id)} className={option(isOn)}>
                  {isOn && <Check aria-hidden size={16} />} {g.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="rounded-xl border border-line">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="product-more"
          onClick={() => setIsOpen((v) => !v)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left hover:bg-subtle"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">{t('Pengaturan lain')}</span>
            <span className="block truncate text-[13px] text-muted">{summary}</span>
          </span>
          <ChevronDown aria-hidden size={18} className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div id="product-more" className="divide-y divide-line border-t border-line px-4 [&>*]:py-2">
            <Switch
              checked={draft.isActive}
              onChange={(isActive) => update({ isActive })}
              label={t('Tampilkan di kasir')}
              description={t('Produk nonaktif disembunyikan dari kasir, tetapi tetap ada di riwayat.')}
            />
            {draft.isActive && (
              <Switch
                checked={draft.isSoldOut === true}
                onChange={(isSoldOut) => update({ isSoldOut })}
                label={t('Sedang habis')}
                description={t('Tetap terlihat di kasir dengan tanda Habis, tetapi tidak bisa dijual. Kasir juga bisa mengubahnya.')}
              />
            )}
            <Switch
              checked={draft.isPriceEditable === true}
              onChange={(isPriceEditable) => update({ isPriceEditable })}
              label={t('Harga bisa diubah saat jual')}
              description={t('Kasir bisa mengetik harga lain di kasir. Harga di atas tetap menjadi harga normal dan ikut tercatat.')}
            />
          </div>
        )}
      </div>
    </>
  );
}

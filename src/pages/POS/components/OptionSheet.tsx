import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import { btnPrimary, option as optionClass } from '../../../components/ui/styles';
import { t } from '../../../i18n';
import { formatRupiah } from '../../../lib/money';
import { unitPriceWithOptions } from '../../../lib/pricing';
import { activeVariants, fromPrice, variantPrice } from '../../../lib/productVariants';
import { perUnit } from '../../../lib/quantity';
import { defaultSelection, toSelectedOptions, toggleOption, validateSelection, type VariantSelection } from '../../../lib/variants';
import type { Product, ProductVariant, SalesMode, SelectedOption, VariantGroup } from '../../../types';

interface OptionSheetProps {
  product: Product;
  /** The product's add-on groups. */
  groups: VariantGroup[];
  mode: SalesMode;
  onClose: () => void;
  onConfirm: (choice: { variant: ProductVariant | undefined; options: SelectedOption[]; unitPrice: number }) => void;
}

const priceDelta = (delta: number) => `${delta > 0 ? '+' : '−'}${formatRupiah(Math.abs(delta)).replace('Rp', '')}`;

/** Variant first (if the product has variants), then add-ons, with the running price (ADR-012). */
export function OptionSheet({ product, groups, mode, onClose, onConfirm }: OptionSheetProps) {
  const variants = activeVariants(product);
  const [variantId, setVariantId] = useState<string | null>(() => (variants.length === 1 && !variants[0]?.isSoldOut ? (variants[0]?.id ?? null) : null));
  const [selection, setSelection] = useState<VariantSelection>(() => defaultSelection(groups));
  const options = useMemo(() => toSelectedOptions(groups, selection), [groups, selection]);

  const variant = variants.find((v) => v.id === variantId);
  const basePrice = variants.length > 0 ? (variant ? variantPrice(product, variant, mode) : null) : fromPrice(product, mode);
  const unitPrice = basePrice === null ? null : unitPriceWithOptions(basePrice, options);
  const error = variants.length > 0 && !variant ? t('Pilih varian') : validateSelection(groups, selection);

  const handleToggle = (group: VariantGroup, optionId: string) =>
    setSelection((prev) => ({ ...prev, [group.id]: toggleOption(group, prev[group.id] ?? [], optionId) }));

  const badge = (isRequired: boolean) => (
    <span className={`rounded-md px-1.5 py-0.5 text-[12px] font-medium ${isRequired ? 'bg-subtle text-ink-soft' : 'text-muted'}`}>
      {isRequired ? t('Wajib') : t('Opsional')}
    </span>
  );

  return (
    <Sheet
      title={product.name}
      subtitle={t('Mulai {0}', `${formatRupiah(fromPrice(product, mode))}${perUnit(product.unit)}`)}
      isOpen
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={error !== null || unitPrice === null}
          onClick={() => unitPrice !== null && onConfirm({ variant, options, unitPrice })}
          className={`${btnPrimary} w-full justify-between!`}
        >
          <span>{error ?? t('Tambah ke pesanan')}</span>
          {error === null && unitPrice !== null && <span className="num">{formatRupiah(unitPrice)}{perUnit(product.unit)}</span>}
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {variants.length > 0 && (
          <fieldset>
            <legend className="mb-2.5 flex w-full items-center gap-2">
              <span className="text-[15px] font-semibold">{t('Varian')}</span>
              {badge(true)}
            </legend>
            <div role="radiogroup" aria-label={t('Varian')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {variants.map((v) => {
                const isSelected = v.id === variantId;
                const isSoldOut = v.isSoldOut === true;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isSoldOut}
                    onClick={() => setVariantId(v.id)}
                    className={`${optionClass(isSelected)} min-h-14 flex-col items-start! justify-center! gap-0 px-3 text-left ${isSoldOut ? 'opacity-50' : ''}`}
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      {isSelected && <Check aria-hidden size={16} className="shrink-0" />}
                      {v.name}
                    </span>
                    <span className="num text-[12px] font-semibold opacity-80">
                      {isSoldOut ? t('Habis') : `${formatRupiah(variantPrice(product, v, mode))}${perUnit(product.unit)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        {groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2.5 flex w-full items-center gap-2">
              <span className="text-[15px] font-semibold">{group.name}</span>
              {badge(group.isRequired)}
              {group.selectType === 'multi' && <span className="text-[13px] text-muted">{t('maks')} {group.max}</span>}
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.options.map((option) => {
                const isSelected = selection[group.id]?.includes(option.id) ?? false;
                return (
                  <button key={option.id} type="button" aria-pressed={isSelected} onClick={() => handleToggle(group, option.id)} className={`${optionClass(isSelected)} min-h-12 justify-between! text-left`}>
                    <span className="flex items-center gap-1.5">
                      {isSelected && <Check aria-hidden size={16} className="shrink-0" />}
                      {option.name}
                    </span>
                    {option.priceDelta !== 0 && <span className="num text-[12px] font-semibold opacity-80">{priceDelta(option.priceDelta)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Sheet>
  );
}

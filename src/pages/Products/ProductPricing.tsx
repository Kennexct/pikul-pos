import { RupiahInput } from '../../components/ui/RupiahInput';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { helperText, labelBase, option, sectionTitle } from '../../components/ui/styles';
import { t } from '../../i18n';
import { formatRupiah } from '../../lib/money';
import { isMeasured, perUnit, SALE_UNITS, UNIT_INFO } from '../../lib/quantity';
import type { Id, Product, SalesMode } from '../../types';
import { ProductVariantsEditor } from './ProductVariantsEditor';

/** "Ons (100 g)" → name "Ons", hint "100 g": two short lines instead of one wrapped label. */
const splitUnitLabel = (label: string): { name: string; hint: string } => {
  const match = /^(.*?)\s*\((.*)\)$/.exec(label);
  return match ? { name: match[1] ?? label, hint: match[2] ?? '' } : { name: label, hint: '' };
};

export type PriceKind = 'single' | 'variants';

interface ProductPricingProps {
  draft: Product;
  update: (patch: Partial<Product>) => void;
  priceKind: PriceKind;
  onPriceKind: (kind: PriceKind) => void;
  salesModes: readonly SalesMode[];
  /** Show "Dijual per" (store setting, or the product already uses a unit). */
  showsUnit: boolean;
}

/** Price block: one price, or a list of variants with their own prices (ADR-012). Extra prices stay small and optional. */
export function ProductPricing({ draft, update, priceKind, onPriceKind, salesModes, showsUnit }: ProductPricingProps) {
  const unit = draft.unit ?? 'pcs';
  const priceModes = salesModes.filter((m) => m.priceRule === 'mode_price');
  const markupModes = salesModes.filter((m) => m.priceRule === 'markup');

  const setModePrice = (modeId: Id, price: number | null) => {
    const { [modeId]: _removed, ...rest } = draft.modePrices;
    update({ modePrices: price === null ? rest : { ...rest, [modeId]: price } });
  };

  const profit =
    draft.costPrice !== undefined && draft.basePrice > 0
      ? isMeasured(unit)
        ? t('Untung per {0} {1} (harga dasar).', UNIT_INFO[unit].symbol, formatRupiah(draft.basePrice - draft.costPrice))
        : t('Untung per porsi {0} (harga dasar).', formatRupiah(draft.basePrice - draft.costPrice))
      : null;

  return (
    <section aria-labelledby="product-price-title" className="rounded-xl border border-line bg-subtle/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="product-price-title" className={sectionTitle}>{t('Harga')}</h3>
        <SegmentedControl
          label={t('Jenis harga')}
          value={priceKind}
          onChange={onPriceKind}
          options={[
            { value: 'single', label: t('Satu harga') },
            { value: 'variants', label: t('Ada varian') },
          ]}
        />
      </div>

      {showsUnit && (
        <div className="mb-4">
          <p className={labelBase}>{t('Dijual per')}</p>
          <div role="radiogroup" aria-label={t('Dijual per')} className="grid grid-cols-3 gap-2">
            {SALE_UNITS.map((value) => {
              const { name, hint } = splitUnitLabel(UNIT_INFO[value].label);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={unit === value}
                  aria-label={UNIT_INFO[value].label}
                  onClick={() => update({ unit: value })}
                  className={`${option(unit === value)} h-14 flex-col gap-0! px-2 leading-tight`}
                >
                  <span className="truncate text-[14px] font-semibold">{name}</span>
                  {hint && <span className="num truncate text-[12px] font-normal text-muted">{hint}</span>}
                </button>
              );
            })}
          </div>
          {isMeasured(unit) && <p className={helperText}>{t('Semua harga di bawah ini adalah harga per {0}. Berat diketik di kasir saat menjual.', UNIT_INFO[unit].symbol)}</p>}
        </div>
      )}

      {priceKind === 'variants' ? (
        <>
          <p className="mb-3 text-[13px] text-muted">{t('Misalnya Kopi: Latte, Americano, Espresso. Setiap varian punya harga sendiri.')}</p>
          <ProductVariantsEditor variants={draft.variants ?? []} priceModes={priceModes} unitSuffix={perUnit(unit)} onChange={(variants) => update({ variants })} />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="base-price" className={labelBase}>
              {t('Harga dasar (Dine In)')} <span className="num font-normal text-muted">{perUnit(unit)}</span>
            </label>
            <RupiahInput id="base-price" size="lg" value={draft.basePrice || null} onChange={(v) => update({ basePrice: v ?? 0 })} />
            {markupModes.length > 0 && <p className={helperText}>{markupModes.map((m) => t('{0}: otomatis +{1}% dari harga dasar', m.name, m.markupPct)).join(' · ')}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {priceModes.map((mode) => (
              <div key={mode.id}>
                <label htmlFor={`price-${mode.id}`} className={labelBase}>
                  {t('Harga')} {mode.name} <span className="font-normal text-muted">{t('(opsional)')}</span>
                </label>
                <RupiahInput id={`price-${mode.id}`} value={draft.modePrices[mode.id] ?? null} onChange={(v) => setModePrice(mode.id, v)} placeholder={t('Ikut harga dasar')} />
              </div>
            ))}
            <div>
              <label htmlFor="cost-price" className={labelBase}>
                {t('Harga modal')} <span className="font-normal text-muted">{t('(opsional)')}</span>
              </label>
              <RupiahInput id="cost-price" value={draft.costPrice ?? null} onChange={(v) => update({ costPrice: v ?? undefined })} placeholder={t('Belum diisi')} />
            </div>
          </div>
          <p className={`${helperText} mt-0!`}>{profit ?? t('Harga modal dipakai untuk menghitung laba di Laporan.')}</p>
        </div>
      )}
    </section>
  );
}

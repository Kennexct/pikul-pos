import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Keypad } from '../../../components/ui/Keypad';
import { RupiahInput } from '../../../components/ui/RupiahInput';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Sheet } from '../../../components/ui/Sheet';
import { btnPrimary, btnSecondary, inputBase, keypadTarget, labelBase, option, sectionTitle } from '../../../components/ui/styles';
import { PERCENT_MAX } from '../../../constants';
import { useKeypad } from '../../../hooks/useKeypad';
import { applyKeypadKeyToNumber } from '../../../lib/keypad';
import { formatRupiah } from '../../../lib/money';
import type { AppliedDiscount, Discount, DiscountType, Id } from '../../../types';
import { t } from '../../../i18n';

interface DiscountSheetProps {
  presets: Discount[];
  current: AppliedDiscount | null;
  /** Ad-hoc percent limit for this user; null = no limit (owner). */
  maxPercent: number | null;
  baseAmount: number;
  /** Asks for the owner PIN; resolves to the approving owner's id, or null when cancelled (ADR-004). */
  onRequestOverride: () => Promise<Id | null>;
  onApply: (discount: AppliedDiscount | null) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'percent', label: t('Persen (%)') },
  { value: 'fixed', label: t('Nominal (Rp)') },
] as const;

/** M6 order-level discount: pick a preset or enter an ad-hoc % / Rp amount. */
export function DiscountSheet({ presets, current, maxPercent, baseAmount, onRequestOverride, onApply, onClose }: DiscountSheetProps) {
  const isCustom = current !== null && current.discountId === null;
  const [type, setType] = useState<DiscountType>(isCustom ? current.type : 'percent');
  const [value, setValue] = useState<number | null>(isCustom ? current.value : null);
  const pad = useKeypad<'value'>('value');
  /** Percent takes up to 3 digits (100); Rupiah gets the "000" key. */
  const isPercent = type === 'percent';

  const effectivePercent = type === 'percent' ? (value ?? 0) : baseAmount > 0 ? ((value ?? 0) / baseAmount) * PERCENT_MAX : 0;
  const isOverLimit = maxPercent !== null && effectivePercent > maxPercent;
  const isBadValue = value === null || value <= 0 || (type === 'percent' && value > PERCENT_MAX);
  const isInvalid = isBadValue || isOverLimit;

  const changeType = (next: DiscountType) => {
    setType(next);
    pad.setActive('value');
    pad.restart();
  };

  const applyPreset = (preset: Discount) =>
    onApply({ discountId: preset.id, name: preset.name, type: preset.type, value: preset.value });

  const applyCustom = (approvedById: Id | null = null) => {
    if (isBadValue || value === null) return;
    const name = type === 'percent' ? t('Diskon {0}%', value) : t('Diskon {0}', formatRupiah(value));
    onApply({ discountId: null, name, type, value, approvedById });
  };

  const applyWithOwnerPin = async () => {
    const ownerId = await onRequestOverride();
    if (ownerId) applyCustom(ownerId);
  };

  return (
    <Sheet
      title={t('Diskon pesanan')}
      subtitle={t('Dari {0}', formatRupiah(baseAmount))}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3">
          {pad.active && (
            <Keypad extraKey={isPercent ? null : '000'} onKey={(key) => setValue(applyKeypadKeyToNumber(value, key, pad.takeFresh(), isPercent ? 3 : 12))} />
          )}
          <div className="flex gap-2">
            {current && (
              <button type="button" onClick={() => onApply(null)} className={btnSecondary}>
                {t('Hapus diskon')}
              </button>
            )}
            <button type="button" disabled={isInvalid} onClick={() => applyCustom()} className={`${btnPrimary} flex-1`}>
              {t('Terapkan')}
            </button>
          </div>
        </div>
      }
    >
      {presets.length > 0 && (
        <section className="mb-6">
          <h3 className={`${sectionTitle} mb-2.5`}>{t('Promo tersimpan')}</h3>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`${option(current?.discountId === preset.id)} min-h-14 flex-col items-start! gap-0 py-2 text-left`}
              >
                <span className="font-semibold">{preset.name}</span>
                <span className="num text-[13px] opacity-80">{preset.type === 'percent' ? `${preset.value}%` : formatRupiah(preset.value)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className={`${sectionTitle} mb-2.5`}>{t('Diskon manual')}</h3>
        <SegmentedControl label={t('Jenis diskon')} options={TYPE_OPTIONS} value={type} onChange={changeType} isFullWidth />
        <div className="mt-3">
          <label htmlFor="discount-value" className={labelBase}>{type === 'percent' ? t('Besar diskon (%)') : t('Besar diskon')}</label>
          {type === 'percent' ? (
            <input
              id="discount-value"
              {...pad.field('value')}
              value={value ?? ''}
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(/[^\d]/g, ''));
                setValue(event.target.value === '' ? null : parsed);
              }}
              placeholder="10"
              className={`${inputBase} ${keypadTarget} num`}
            />
          ) : (
            <RupiahInput id="discount-value" value={value} onChange={setValue} keypad={pad.field('value')} />
          )}
        </div>
        {isOverLimit && !isBadValue && (
          <div role="alert" className="mt-3 rounded-lg border border-warn-200 bg-warn-50 p-3">
            <p className="text-[13px] text-warn-700">{t('Melebihi batas diskon kasir (')}{maxPercent}%).</p>
            <button type="button" onClick={() => void applyWithOwnerPin()} className={`${btnSecondary} mt-2 h-11 w-full text-[14px]`}>
              <Lock aria-hidden size={16} /> {t('Setujui dengan PIN pemilik')}
            </button>
          </div>
        )}
      </section>
    </Sheet>
  );
}

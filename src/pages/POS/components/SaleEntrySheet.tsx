import { Scale } from 'lucide-react';
import { useState } from 'react';
import { RupiahInput } from '../../../components/ui/RupiahInput';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Sheet } from '../../../components/ui/Sheet';
import { btnPrimary, chip, helperText, inputBase, labelBase } from '../../../components/ui/styles';
import { t } from '../../../i18n';
import { formatRupiah } from '../../../lib/money';
import { lineGross } from '../../../lib/pricing';
import { formatQuantity, isMeasured, parseQuantity, perUnit, quantityForAmount, roundQuantity, UNIT_INFO } from '../../../lib/quantity';
import type { Rupiah, SaleUnit } from '../../../types';

type EntryMode = 'quantity' | 'amount';
const QUICK_AMOUNTS: readonly Rupiah[] = [5_000, 10_000, 20_000];

export interface SaleEntry {
  qty: number;
  unitPrice: Rupiah;
}

interface SaleEntrySheetProps {
  name: string;
  unit: SaleUnit | undefined;
  isPriceEditable: boolean;
  /** The product's price for the current sales mode, options included. */
  normalPrice: Rupiah;
  /** Present when changing a line that is already in the cart. */
  initial?: SaleEntry;
  onConfirm: (entry: SaleEntry) => void;
  onClose: () => void;
}

/**
 * Entry box for products sold by weight/measure and for flexible-price products (ADR-011):
 * type the weight or the money amount, and the price when it may be changed. The total is shown before adding.
 */
export function SaleEntrySheet({ name, unit, isPriceEditable, normalPrice, initial, onConfirm, onClose }: SaleEntrySheetProps) {
  const measured = isMeasured(unit);
  const info = UNIT_INFO[unit ?? 'pcs'];
  const [mode, setMode] = useState<EntryMode>('quantity');
  const [quantityText, setQuantityText] = useState(initial && measured ? formatQuantity(initial.qty, undefined) : '');
  const [amount, setAmount] = useState<Rupiah | null>(null);
  const [price, setPrice] = useState<Rupiah | null>(initial?.unitPrice ?? normalPrice);

  const unitPrice = isPriceEditable ? price : normalPrice;
  const typed = parseQuantity(quantityText);
  // A line entered by money amount keeps its exact quantity unless the seller types a different weight.
  const typedQty = initial && typed !== null && typed === roundQuantity(initial.qty) ? initial.qty : typed;
  const qty = !measured ? (initial?.qty ?? 1) : mode === 'quantity' ? typedQty : unitPrice && amount ? quantityForAmount(amount, unitPrice) : null;
  const isValid = unitPrice !== null && qty !== null;
  const total = isValid ? lineGross({ unitPrice, qty }) : null;
  const isPriceChanged = isPriceEditable && price !== null && price !== normalPrice;

  const submit = () => {
    if (unitPrice !== null && qty !== null) onConfirm({ qty, unitPrice });
  };

  return (
    <Sheet
      title={name}
      subtitle={t('Harga normal {0}', `${formatRupiah(normalPrice)}${perUnit(unit)}`)}
      isOpen
      onClose={onClose}
      footer={
        <button type="button" disabled={!isValid} onClick={submit} className={`${btnPrimary} w-full justify-between! px-5`}>
          <span>{initial ? t('Simpan perubahan') : t('Tambah ke pesanan')}</span>
          <span className="num">{total === null ? '' : formatRupiah(total)}</span>
        </button>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {measured && (
          <div className="flex flex-col gap-3">
            <SegmentedControl
              label={t('Cara mengisi')}
              options={[
                { value: 'quantity', label: t('Timbang ({0})', info.symbol) },
                { value: 'amount', label: t('Nominal (Rp)') },
              ]}
              value={mode}
              onChange={setMode}
              isFullWidth
            />
            {mode === 'quantity' ? (
              <div>
                <label htmlFor="entry-quantity" className={labelBase}>{t('Berat atau ukuran ({0})', info.symbol)}</label>
                <div className="relative">
                  <input
                    id="entry-quantity"
                    autoFocus
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={quantityText}
                    onChange={(event) => setQuantityText(event.target.value)}
                    className={`${inputBase} num h-14 pr-14 text-right text-[22px] font-semibold`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[15px] font-semibold text-muted">{info.symbol}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  {info.quick.map((value) => (
                    <button key={value} type="button" onClick={() => setQuantityText(formatQuantity(value, undefined))} className={`${chip(parseQuantity(quantityText) === value)} num h-11 flex-1 text-[14px]`}>
                      {formatQuantity(value, unit)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="entry-amount" className={labelBase}>{t('Pembeli minta seharga')}</label>
                <RupiahInput id="entry-amount" value={amount} onChange={setAmount} autoFocus size="lg" />
                <div className="mt-2 flex gap-2">
                  {QUICK_AMOUNTS.map((value) => (
                    <button key={value} type="button" onClick={() => setAmount(value)} className={`${chip(amount === value)} num h-11 flex-1 text-[14px]`}>
                      {formatRupiah(value)}
                    </button>
                  ))}
                </div>
                {/* What to put on the scale: the number the seller acts on, so it gets the biggest type here. */}
                <div
                  aria-live="polite"
                  className={`mt-3 flex min-h-[72px] items-center gap-3 rounded-xl px-4 py-3 ${qty !== null ? 'border-2 border-brand-600 bg-brand-50' : 'border border-dashed border-line-strong bg-subtle'}`}
                >
                  <Scale aria-hidden size={26} className={`shrink-0 ${qty !== null ? 'text-brand-700' : 'text-muted'}`} />
                  {qty !== null ? (
                    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="text-[14px] font-semibold text-brand-800">{t('Timbang sebanyak')}</span>
                      <span className="num text-[28px] font-semibold leading-none text-brand-800">{formatQuantity(qty, unit)}</span>
                    </p>
                  ) : (
                    <p className="text-[14px] text-muted">{t('Isi nominal untuk melihat beratnya.')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isPriceEditable && (
          <div>
            <label htmlFor="entry-price" className={labelBase}>{measured ? t('Harga per {0}', info.symbol) : t('Harga jual')}</label>
            <RupiahInput id="entry-price" value={price} onChange={setPrice} autoFocus={!measured} size={measured ? 'md' : 'lg'} />
            <p className={helperText}>
              {isPriceChanged ? (
                <button type="button" onClick={() => setPrice(normalPrice)} className="font-semibold text-brand-700 underline-offset-2 hover:underline">
                  {t('Kembalikan ke harga normal')}
                </button>
              ) : (
                t('Ketik harga hari ini kalau berbeda dari harga normal.')
              )}
            </p>
          </div>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

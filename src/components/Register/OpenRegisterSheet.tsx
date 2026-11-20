import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { formatBusinessDate } from '../../lib/dateRange';
import { formatRupiah } from '../../lib/money';
import { setOpeningCash } from '../../services/dayClosing';
import type { BusinessDate, Id } from '../../types';
import { RupiahInput } from '../ui/RupiahInput';
import { Sheet } from '../ui/Sheet';
import { btnPrimary, btnSecondary, helperText, labelBase } from '../ui/styles';
import { CashCounter } from './CashCounter';
import { t } from '../../i18n';

interface OpenRegisterSheetProps {
  storeId: Id;
  actorId: Id;
  businessDate: BusinessDate;
  /** Prefilled amount (today's typed amount, else the last closing's opening cash). */
  suggested: number;
  /** "Buka kasir" before the first sale, or "Modal awal" when changing it on the Kas page. */
  mode: 'open' | 'edit';
  isYesterdayUnclosed?: boolean;
  onDone: () => void;
  onClose: () => void;
}

/** Count the drawer and open the register for the day (ADR-017). Also edits the opening cash on the Kas page. */
export function OpenRegisterSheet({ storeId, actorId, businessDate, suggested, mode, isYesterdayUnclosed = false, onDone, onClose }: OpenRegisterSheetProps) {
  const [amount, setAmount] = useState<number | null>(suggested > 0 ? suggested : null);
  const [isSaving, setIsSaving] = useState(false);
  const isOpening = mode === 'open';

  const submit = async () => {
    setIsSaving(true);
    try {
      await setOpeningCash(storeId, businessDate, amount ?? 0, actorId);
      if (isOpening) toast.success(t('Kasir dibuka · modal {0}', formatRupiah(amount ?? 0)));
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Terjadi kesalahan.'));
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      title={isOpening ? t('Buka kasir') : t('Modal awal')}
      subtitle={formatBusinessDate(businessDate)}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {isOpening && <button type="button" onClick={onClose} className={btnSecondary}>{t('Nanti saja')}</button>}
          <button type="button" disabled={isSaving} onClick={() => void submit()} className={`${btnPrimary} flex-1`}>
            {isOpening ? t('Buka kasir') : t('Simpan modal awal')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {isOpening && <p className="text-[14px] text-ink-soft">{t('Hitung uang di laci sebelum penjualan pertama hari ini. Angka ini jadi dasar hitungan saat tutup kasir.')}</p>}
        {isYesterdayUnclosed && (
          <p className="flex gap-2 rounded-lg border border-warn-200 bg-warn-50 px-3 py-2.5 text-[13px] text-warn-700">
            <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
            <span>
              {t('Kasir kemarin belum ditutup.')}{' '}
              <Link to={ROUTES.cash} onClick={onClose} className="font-semibold underline">{t('Tutup kemarin dulu')}</Link>
            </span>
          </p>
        )}
        <div>
          <label htmlFor="opening-cash" className={labelBase}>{t('Uang di laci saat mulai jualan')}</label>
          <RupiahInput id="opening-cash" value={amount} onChange={setAmount} autoFocus size="lg" />
          <p className={helperText}>{t('Uang kembalian yang sudah ada di laci sebelum penjualan pertama.')}</p>
        </div>
        <CashCounter onTotal={setAmount} />
      </div>
    </Sheet>
  );
}

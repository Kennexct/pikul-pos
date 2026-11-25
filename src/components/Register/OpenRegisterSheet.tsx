import { History, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { formatBusinessDate } from '../../lib/dateRange';
import { formatRupiah } from '../../lib/money';
import { formatClockTime, shiftNoOf } from '../../lib/shifts';
import { setOpeningCash } from '../../services/dayClosing';
import type { BusinessDate, DayClosing, Id } from '../../types';
import { RupiahInput } from '../ui/RupiahInput';
import { Sheet } from '../ui/Sheet';
import { btnPrimary, btnSecondary, helperText, labelBase } from '../ui/styles';
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
  /** The shift being opened (ADR-027). From 2 on, the sheet says which shift closed and when. */
  shiftNo?: number;
  /** The day's last closing, when opening a later shift. */
  lastClosing?: DayClosing | null;
  timeZone?: string;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Count the drawer and open the register (ADR-017). After a closing the same day it opens a new shift, never the closed one (ADR-027).
 * Also edits the opening cash on the Kas page.
 */
export function OpenRegisterSheet(props: OpenRegisterSheetProps) {
  const { storeId, actorId, businessDate, suggested, mode, isYesterdayUnclosed = false, shiftNo = 1, lastClosing = null, timeZone = 'Asia/Jakarta', onDone, onClose } = props;
  const [amount, setAmount] = useState<number | null>(suggested > 0 ? suggested : null);
  const [isSaving, setIsSaving] = useState(false);
  const isOpening = mode === 'open';
  const isNewShift = isOpening && shiftNo > 1;
  const day = formatBusinessDate(businessDate);

  const submit = async () => {
    setIsSaving(true);
    try {
      await setOpeningCash(storeId, businessDate, amount ?? 0, actorId);
      if (isNewShift) toast.success(t('Shift {0} dibuka · modal {1}', shiftNo, formatRupiah(amount ?? 0)));
      else if (isOpening) toast.success(t('Kasir dibuka · modal {0}', formatRupiah(amount ?? 0)));
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Terjadi kesalahan.'));
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      title={isNewShift ? t('Buka shift baru') : isOpening ? t('Buka kasir') : t('Modal awal')}
      subtitle={shiftNo > 1 ? t('Shift {0} · {1}', shiftNo, day) : day}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {isOpening && <button type="button" onClick={onClose} className={btnSecondary}>{t('Nanti saja')}</button>}
          <button type="button" disabled={isSaving} onClick={() => void submit()} className={`${btnPrimary} flex-1`}>
            {isNewShift ? t('Buka shift {0}', shiftNo) : isOpening ? t('Buka kasir') : t('Simpan modal awal')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {isNewShift && lastClosing && (
          <p className="flex gap-2 rounded-lg border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink-soft">
            <History aria-hidden size={16} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold text-ink">{t('Shift {0} ditutup {1}', shiftNoOf(lastClosing), formatClockTime(lastClosing.closedAt, timeZone))}</span>
              {' · '}
              {t('dihitung {0}. Hasilnya tetap tersimpan, penjualan berikutnya masuk shift {1}.', formatRupiah(lastClosing.countedCash), shiftNo)}
            </span>
          </p>
        )}
        {isOpening && !isNewShift && <p className="text-[14px] text-ink-soft">{t('Hitung uang di laci sebelum penjualan pertama hari ini. Angka ini jadi dasar hitungan saat tutup kasir.')}</p>}
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
          <label htmlFor="opening-cash" className={labelBase}>{isNewShift ? t('Uang di laci saat shift mulai') : t('Uang di laci saat mulai jualan')}</label>
          <RupiahInput id="opening-cash" value={amount} onChange={setAmount} autoFocus size="lg" />
          <p className={helperText}>
            {isNewShift ? t('Terisi dari hitungan shift sebelumnya. Ubah kalau ada uang yang diambil atau ditambah.') : t('Uang kembalian yang sudah ada di laci sebelum penjualan pertama.')}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

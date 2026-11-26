import { formatRupiah } from '../../../lib/money';
import { t } from '../../../i18n';

/** Phone only: the floating bar that opens the cart sheet. */
export function CartBar({ itemCount, total, onOpen }: { itemCount: number; total: number; onOpen: () => void }) {
  if (itemCount <= 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 px-3 pb-2 md:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="animate-sheet flex h-14 w-full items-center gap-3 rounded-xl bg-ink px-4 text-white shadow-pop active:translate-y-px"
      >
        <span key={itemCount} className="num animate-pop flex h-7 min-w-7 items-center justify-center rounded-md bg-brand-500 px-1.5 text-[13px] font-semibold">{itemCount}</span>
        <span className="text-[15px] font-semibold">{t('Lihat pesanan')}</span>
        <span className="num ml-auto text-[16px] font-semibold">{formatRupiah(total)}</span>
      </button>
    </div>
  );
}

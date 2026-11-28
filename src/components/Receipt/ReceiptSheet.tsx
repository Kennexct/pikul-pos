import { CircleCheck } from 'lucide-react';
import { useCustomer } from '../../hooks/useCustomers';
import { formatRupiah } from '../../lib/money';
import type { Order, Store } from '../../types';
import { Sheet } from '../ui/Sheet';
import { btnPrimary } from '../ui/styles';
import { ReceiptShareActions } from './ReceiptShareActions';
import { ReceiptView } from './ReceiptView';
import { t } from '../../i18n';

interface ReceiptSheetProps {
  order: Order;
  store: Store;
  cashierName: string;
  onClose: () => void;
}

/** M9: success state (change first — the cashier needs it now), then receipt with print, WhatsApp, email and image (ADR-028). */
export function ReceiptSheet({ order, store, cashierName, onClose }: ReceiptSheetProps) {
  const customer = useCustomer(order.customerId);
  const payment = order.payments[0];
  const change = payment?.change ?? 0;

  return (
    <Sheet
      title={order.status === 'paid' ? t('Pembayaran berhasil') : t('Struk')}
      subtitle={order.receiptNo}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <ReceiptShareActions order={order} store={store} cashierName={cashierName} customer={customer} printLabel={t('Cetak')} />
          <button type="button" autoFocus onClick={onClose} className={btnPrimary}>
            {t('Transaksi baru')}
          </button>
        </div>
      }
    >
      {order.status === 'paid' && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
          <CircleCheck aria-hidden size={28} className="shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-brand-800">
              {t('Lunas ·')} {payment?.methodNameSnapshot} · {formatRupiah(order.totals.grandTotal)}
            </p>
            {payment?.methodType === 'cash' && (
              <p className="num text-[22px] font-semibold tracking-[-0.02em] text-brand-900">{t('Kembalian')} {formatRupiah(change)}</p>
            )}
          </div>
        </div>
      )}
      <div className="rounded-lg bg-subtle px-3 py-4">
        <ReceiptView order={order} store={store} cashierName={cashierName} />
      </div>
    </Sheet>
  );
}

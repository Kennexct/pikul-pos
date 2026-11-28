import { Ban, Lock, Undo2 } from 'lucide-react';
import { ReceiptShareActions } from '../../components/Receipt/ReceiptShareActions';
import { ReceiptView } from '../../components/Receipt/ReceiptView';
import { Sheet } from '../../components/ui/Sheet';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { btnDanger, btnSecondary } from '../../components/ui/styles';
import { useCustomer } from '../../hooks/useCustomers';
import { formatRupiah } from '../../lib/money';
import { totalRefunded } from '../../lib/refunds';
import type { Eligibility } from '../../services/refunds';
import type { Order, Refund, Store } from '../../types';
import { DATE_LOCALE, t } from '../../i18n';
import { hasPriceChange, perUnit } from '../../lib/quantity';

interface OrderDetailSheetProps {
  order: Order;
  refunds: Refund[];
  store: Store;
  cashierName: string;
  voidEligibility: Eligibility;
  refundEligibility: Eligibility;
  onVoid: () => void;
  onRefund: () => void;
  onClose: () => void;
}

const dateTime = new Intl.DateTimeFormat(DATE_LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

/** M10 detail: status, money summary, receipt (with refund lines), and allowed actions with reasons when not allowed. */
export function OrderDetailSheet(props: OrderDetailSheetProps) {
  const { order, refunds, store, cashierName, voidEligibility, refundEligibility, onVoid, onRefund, onClose } = props;
  const customer = useCustomer(order.customerId);
  const refunded = totalRefunded(refunds.filter((r) => r.kind === 'refund'));
  const canAct = (e: Eligibility): boolean => e.ok || e.needsOwnerPin === true;
  const needsPin = (e: Eligibility): boolean => !e.ok && e.needsOwnerPin === true;
  const isAnyActionable = canAct(voidEligibility) || canAct(refundEligibility);
  const blockedReason = isAnyActionable ? null : refundEligibility.ok ? null : refundEligibility.reason;
  const voidHint = !canAct(voidEligibility) && canAct(refundEligibility) && order.status === 'paid' && !voidEligibility.ok ? voidEligibility.reason : null;

  const changedPrices = order.items.filter(hasPriceChange);

  return (
    <Sheet
      title={order.receiptNo}
      subtitle={dateTime.format(new Date(order.paidAt ?? order.updatedAt))}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <ReceiptShareActions order={order} store={store} cashierName={cashierName} refunds={refunds} customer={customer} printLabel={t('Cetak ulang')} />
          {isAnyActionable && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!canAct(refundEligibility)} onClick={onRefund} className={btnSecondary}>
                <Undo2 aria-hidden size={18} /> {t('Refund')}
                {needsPin(refundEligibility) && <Lock aria-label={t('butuh PIN pemilik')} size={14} className="text-faint" />}
              </button>
              <button type="button" disabled={!canAct(voidEligibility)} onClick={onVoid} className={btnDanger}>
                <Ban aria-hidden size={18} /> {t('Void')}
                {needsPin(voidEligibility) && <Lock aria-label={t('butuh PIN pemilik')} size={14} />}
              </button>
            </div>
          )}
          {blockedReason && order.status !== 'cancelled' && <p className="text-center text-[13px] text-muted">{blockedReason}</p>}
          {voidHint && <p className="text-center text-[13px] text-muted">{voidHint}</p>}
        </div>
      }
    >
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line p-4 text-[14px]">
        <div>
          <dt className="text-[13px] text-muted">{t('Status')}</dt>
          <dd className="mt-0.5"><StatusBadge status={order.status} /></dd>
        </div>
        <div className="text-right">
          <dt className="text-[13px] text-muted">{t('Total')}</dt>
          <dd className={`num text-[20px] font-semibold tracking-[-0.02em] ${order.status === 'void' ? 'text-muted line-through' : ''}`}>
            {formatRupiah(order.totals.grandTotal)}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">{t('Pembayaran')}</dt>
          <dd className="font-medium">
            {order.payments[0]?.methodNameSnapshot ?? '—'}
            {order.payments[0]?.reference && <span className="num block text-[13px] text-muted">{t('Ref')} {order.payments[0].reference}</span>}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-[13px] text-muted">{refunded > 0 ? t('Sudah direfund') : t('Mode')}</dt>
          <dd className={`num font-medium ${refunded > 0 ? 'text-warn-700' : ''}`}>
            {refunded > 0 ? `−${formatRupiah(refunded)}` : order.salesModeNameSnapshot}
          </dd>
        </div>
      </dl>
      {changedPrices.length > 0 && (
        <div className="mb-3 rounded-lg border border-warn-200 bg-warn-50 px-3.5 py-2.5 text-[13px] text-warn-700">
          <p className="font-semibold">{t('Harga diubah saat jual')}</p>
          <ul className="num mt-1 flex flex-col gap-0.5">
            {changedPrices.map((item) => (
              <li key={item.id}>
                {item.nameSnapshot}: {formatRupiah(item.unitPrice)}{perUnit(item.unit)} · {t('harga normal {0}', `${formatRupiah(item.listPrice ?? 0)}${perUnit(item.unit)}`)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-lg bg-subtle px-3 py-4">
        <ReceiptView order={order} store={store} cashierName={cashierName} refunds={refunds} />
      </div>
    </Sheet>
  );
}

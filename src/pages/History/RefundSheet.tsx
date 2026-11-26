import { Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { btnIcon, btnPrimary, btnSecondary, sectionTitle } from '../../components/ui/styles';
import { formatRupiah } from '../../lib/money';
import { buildRefundItems, remainingQtyByItem } from '../../lib/refunds';
import type { ReasonInput } from '../../services/refunds';
import type { Id, Order, Refund } from '../../types';
import { ReasonPicker } from './ReasonPicker';
import { t } from '../../i18n';
import { formatQuantity, isMeasured, perUnit } from '../../lib/quantity';

interface RefundSheetProps {
  order: Order;
  refunds: Refund[];
  isSubmitting: boolean;
  onConfirm: (selections: Array<{ orderItemId: Id; qty: number }>, reason: ReasonInput) => void;
  onClose: () => void;
}

/** M11 partial/full refund: choose qty per line; amount is previewed with the same logic the service uses. */
export function RefundSheet({ order, refunds, isSubmitting, onConfirm, onClose }: RefundSheetProps) {
  const remaining = useMemo(() => remainingQtyByItem(order, refunds), [order, refunds]);
  const [qty, setQty] = useState<Record<Id, number>>({});
  const [reason, setReason] = useState<ReasonInput>({ code: 'customer_cancel', note: '' });

  const selections = useMemo(
    () => Object.entries(qty).map(([orderItemId, q]) => ({ orderItemId, qty: q })).filter((s) => s.qty > 0),
    [qty],
  );
  const preview = useMemo(() => {
    if (selections.length === 0) return null;
    try {
      return buildRefundItems(order, selections, refunds);
    } catch {
      return null;
    }
  }, [order, refunds, selections]);

  const selectAll = () => setQty(Object.fromEntries(Array.from(remaining.entries())));
  const change = (id: Id, delta: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.min(remaining.get(id) ?? 0, Math.max(0, (prev[id] ?? 0) + delta)) }));
  const method = order.payments[0]?.methodNameSnapshot ?? t('pembayaran awal');

  return (
    <Sheet
      title={t('Refund item')}
      subtitle={order.receiptNo}
      isOpen
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>{t('Kembali')}</button>
          <button type="button" disabled={!preview || isSubmitting} onClick={() => onConfirm(selections, reason)} className={`${btnPrimary} flex-1 justify-between!`}>
            <span>{isSubmitting ? t('Memproses…') : t('Refund via {0}', method)}</span>
            <span className="num">{preview ? formatRupiah(preview.amount) : t('Rp0')}</span>
          </button>
        </div>
      }
    >
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className={sectionTitle}>{t('Item dikembalikan')}</h3>
        <button type="button" onClick={selectAll} className="h-9 rounded-md px-2 text-[14px] font-semibold text-brand-700 hover:bg-brand-50">
          {t('Pilih semua')}
        </button>
      </div>
      <ul className="mb-5 divide-y divide-line rounded-lg border border-line">
        {order.items.map((item) => {
          const left = remaining.get(item.id) ?? 0;
          const selected = qty[item.id] ?? 0;
          // A weighed line goes back whole (ADR-011); pieces one at a time.
          const step = isMeasured(item.unit) ? left : 1;
          return (
            <li key={item.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${left === 0 ? 'opacity-50' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{item.nameSnapshot}</p>
                <p className="num text-[13px] text-muted">
                  {formatRupiah(item.unitPrice)}{perUnit(item.unit)} · {left === 0 ? t('sudah direfund') : t('sisa {0} dari {1}', formatQuantity(left, item.unit), formatQuantity(item.qty, item.unit))}
                </p>
              </div>
              <button type="button" aria-label={t('Kurangi refund {0}', item.nameSnapshot)} disabled={selected === 0} onClick={() => change(item.id, -step)} className={btnIcon}>
                <Minus aria-hidden size={17} />
              </button>
              <span className="num min-w-7 text-center text-[15px] font-semibold">{formatQuantity(selected, item.unit)}</span>
              <button type="button" aria-label={t('Tambah refund {0}', item.nameSnapshot)} disabled={selected >= left} onClick={() => change(item.id, step)} className={btnIcon}>
                <Plus aria-hidden size={17} />
              </button>
            </li>
          );
        })}
      </ul>
      {order.orderDiscount || order.totals.serviceTotal > 0 || order.totals.taxTotal > 0 ? (
        <p className="-mt-3 mb-5 text-[13px] text-muted">{t('Diskon, service dan pajak ikut dikembalikan secara proporsional.')}</p>
      ) : null}
      <ReasonPicker value={reason} onChange={setReason} />
    </Sheet>
  );
}

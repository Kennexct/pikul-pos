import { useLiveQuery } from 'dexie-react-hooks';
import { ClipboardCheck, Clock } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/Layout/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Sheet } from '../../components/ui/Sheet';
import { btnDanger, btnDangerSolid, btnPrimary, btnSecondary, card, inputBase, labelBase, option } from '../../components/ui/styles';
import { ROUTES } from '../../constants';
import { localDb } from '../../db/localDb';
import { formatRupiah } from '../../lib/money';
import { cancelOpenOrder } from '../../services/orders';
import { useCartStore } from '../../store/useCartStore';
import { useSessionStore } from '../../store/useSessionStore';
import type { Order } from '../../types';
import { t } from '../../i18n';
import { formatLineQty } from '../../lib/quantity';

const CANCEL_REASONS = [t('Pelanggan batal'), t('Salah input'), t('Produk habis')] as const;
const MINUTE_MS = 60_000;
const STALE_AFTER_MINUTES = 60;

function minutesSince(openedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / MINUTE_MS));
}

function ageLabel(minutes: number): string {
  if (minutes < 60) return t('{0} mnt', minutes);
  return t('{0} j {1} mnt', Math.floor(minutes / 60), minutes % 60);
}

/** M8: unpaid ("bayar nanti") orders — resume to add items / pay, or cancel with reason. */
export function OpenOrdersPage() {
  const storeId = useSessionStore((s) => s.storeId);
  const actorId = useSessionStore((s) => s.cashier?.memberId ?? '');
  const cartItemCount = useCartStore((s) => s.items.length);
  const loadOrder = useCartStore((s) => s.loadOrder);
  const navigate = useNavigate();
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<Order | null>(null);
  const [reason, setReason] = useState('');

  const orders = useLiveQuery(
    async () => (storeId ? localDb.orders.where('[storeId+status]').equals([storeId, 'open']).sortBy('openedAt') : []),
    [storeId],
  );

  const openInPos = (order: Order) => {
    loadOrder(order);
    navigate(ROUTES.pos);
  };
  const resume = (order: Order) => (cartItemCount > 0 ? setReplaceTarget(order) : openInPos(order));

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelOpenOrder(cancelTarget.id, reason, actorId);
      toast.success(t('Pesanan "{0}" dibatalkan', cancelTarget.label));
      setCancelTarget(null);
      setReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal membatalkan pesanan.'));
    }
  };

  const now = Date.now();
  const total = orders?.reduce((sum, o) => sum + o.totals.grandTotal, 0) ?? 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('Pesanan terbuka')}
        helpTopic="simpan"
        description={orders && orders.length > 0 ? t('{0} pesanan belum dibayar · {1}', orders.length, formatRupiah(total)) : t('Pesanan yang disimpan untuk dibayar nanti.')}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:px-8 md:py-6">
        {orders?.length === 0 && (
          <EmptyState icon={ClipboardCheck} title={t('Semua pesanan sudah dibayar')} description={t('Gunakan tombol Simpan di kasir untuk menyimpan pesanan bayar nanti.')} />
        )}
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders?.map((order) => {
            const minutes = minutesSince(order.openedAt, now);
            const isStale = minutes >= STALE_AFTER_MINUTES;
            return (
              <li key={order.id} className={`${card} flex flex-col shadow-xs`}>
                <div className="flex items-start gap-3 px-4 pt-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold tracking-[-0.01em]">{order.label}</p>
                    <p className="num truncate text-[13px] text-muted">
                      {order.receiptNo} · {order.salesModeNameSnapshot}
                      {order.customerNameSnapshot ? ` · ${order.customerNameSnapshot}` : ''}
                    </p>
                  </div>
                  <span className={`num inline-flex h-6 items-center gap-1 rounded-md px-2 text-[12px] font-semibold ${isStale ? 'bg-warn-50 text-warn-700' : 'bg-subtle text-ink-soft'}`}>
                    <Clock aria-hidden size={13} /> {ageLabel(minutes)}
                  </span>
                </div>
                <p className="line-clamp-2 px-4 pt-2 text-[13px] text-ink-soft">
                  {order.items.map((i) => `${formatLineQty(i)} ${i.nameSnapshot}`).join(', ')}
                </p>
                <div className="mt-auto flex items-center gap-2 px-4 pb-4 pt-3">
                  <p className="num flex-1 text-[20px] font-semibold tracking-[-0.02em]">{formatRupiah(order.totals.grandTotal)}</p>
                  <button type="button" onClick={() => setCancelTarget(order)} className={`${btnDanger} h-11`}>{t('Batalkan')}</button>
                  <button type="button" onClick={() => resume(order)} className={`${btnPrimary} h-11`}>{t('Buka')}</button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {replaceTarget && (
        <Sheet
          title={t('Ganti isi keranjang?')}
          subtitle={t('Membuka "{0}"', replaceTarget.label)}
          isOpen
          onClose={() => setReplaceTarget(null)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setReplaceTarget(null)} className={btnSecondary}>{t('Batal')}</button>
              <button type="button" onClick={() => openInPos(replaceTarget)} className={`${btnPrimary} flex-1`}>{t('Ganti & buka')}</button>
            </div>
          }
        >
          <p className="text-[14px] text-ink-soft">{t('Keranjang di kasir masih berisi item. Item tersebut akan dihapus jika Anda membuka pesanan ini.')}</p>
        </Sheet>
      )}

      {cancelTarget && (
        <Sheet
          title={t('Batalkan "{0}"?', cancelTarget.label)}
          subtitle={`${cancelTarget.receiptNo} · ${formatRupiah(cancelTarget.totals.grandTotal)}`}
          isOpen
          onClose={() => setCancelTarget(null)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setCancelTarget(null)} className={btnSecondary}>{t('Kembali')}</button>
              <button type="button" disabled={!reason.trim()} onClick={() => void confirmCancel()} className={`${btnDangerSolid} flex-1`}>
                {t('Batalkan pesanan')}
              </button>
            </div>
          }
        >
          <p className={labelBase}>{t('Alasan pembatalan')}</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {CANCEL_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={option(reason === r)}>{r}</button>
            ))}
          </div>
          <input aria-label={t('Alasan lain')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Atau tulis alasan lain')} className={inputBase} />
          <p className="mt-2 text-[13px] text-muted">{t('Pembatalan dicatat beserta nama kasir dan alasannya.')}</p>
        </Sheet>
      )}
    </section>
  );
}

import { BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { APP_EVENTS } from '../../lib/appEvents';
import { BILLING_ENABLED } from '../../services/account';
import { sendDailyTotals } from '../../services/dailyTotals';
import { useAccessStore } from '../../store/useAccessStore';
import { useSessionStore } from '../../store/useSessionStore';
import { t } from '../../i18n';
import { btnPrimary } from '../ui/styles';
import { Sheet } from '../ui/Sheet';

const FIRST_DELAY_MS = 5_000;
const EVERY_MS = 30 * 60_000;
const NOTICE_KEY = 'kk.dailyTotalsNotice';

const noticeSeen = () => {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return true; // storage blocked: do not nag on every open
  }
};

/**
 * ADR-020: sends the store's daily totals to Pikul in the background (5 s after open, every 30 min, when back online,
 * after Tutup kasir) and tells the owner once what is sent. Renders nothing else; never touches the sell path.
 */
export function DailyTotals() {
  const storeId = useSessionStore((s) => s.storeId);
  const account = useAccessStore((s) => s.claims?.sub ?? null);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (!BILLING_ENABLED || !account || !storeId) return undefined;
    const send = () => void sendDailyTotals(storeId);
    const first = window.setTimeout(send, FIRST_DELAY_MS);
    const every = window.setInterval(send, EVERY_MS);
    window.addEventListener('online', send);
    window.addEventListener(APP_EVENTS.dayClosed, send);
    if (!noticeSeen()) setShowNotice(true);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.removeEventListener('online', send);
      window.removeEventListener(APP_EVENTS.dayClosed, send);
    };
  }, [account, storeId]);

  if (!showNotice) return null;
  const close = () => {
    try {
      localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      /* private mode */
    }
    setShowNotice(false);
  };
  return (
    <Sheet
      title={t('Ringkasan penjualan harian')}
      isOpen
      onClose={close}
      footer={
        <button type="button" className={`${btnPrimary} w-full`} onClick={close}>
          {t('Mengerti')}
        </button>
      }
    >
      <div className="flex gap-3">
        <BarChart3 aria-hidden size={22} className="mt-0.5 shrink-0 text-brand-600" />
        <div className="space-y-2 text-[15px] leading-relaxed text-ink-soft">
          <p>{t('Saat online, Pikul menerima ringkasan total penjualan harian toko Anda: jumlah transaksi, nilai penjualan, refund, jenis pembayaran, mode penjualan, dan jam ramai.')}</p>
          <p>{t('Isi struk, nama menu, harga, data pelanggan, dan staf tidak pernah dikirim. Ringkasan ini dipakai untuk layanan dan laporan Pikul.')}</p>
        </div>
      </div>
    </Sheet>
  );
}

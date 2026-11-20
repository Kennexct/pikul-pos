import { LockOpen, Store as StoreIcon } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OpenRegisterSheet } from '../../components/Register/OpenRegisterSheet';
import { Sheet } from '../../components/ui/Sheet';
import { btnPrimary, btnSecondary } from '../../components/ui/styles';
import { ROUTES } from '../../constants';
import { useIsUnclosed, useRegister } from '../../hooks/useCash';
import { getBusinessDate } from '../../lib/businessDate';
import { addDays } from '../../lib/dateRange';
import type { Id, Store } from '../../types';
import { t } from '../../i18n';

interface RegisterGate {
  /** Slim bar above the menu while the register is not open, or already closed. */
  banner: ReactNode;
  /** The open-register or closed-day sheet, when one is showing. */
  sheet: ReactNode;
  /** Runs `next` now when the register is open; otherwise asks first and runs it after (ADR-017). */
  guard: (next: () => void) => void;
}

type Asking = 'open' | 'closed' | null;

/**
 * Register-open gate for the cashier (ADR-017). Local only: reads Dexie, never the network.
 * While the status is loading it lets the sale through, so a slow device never blocks selling.
 */
export function useRegisterGate(store: Store | undefined, cashierId: Id): RegisterGate {
  const storeId = store?.id ?? null;
  const today = store ? getBusinessDate(new Date(), store) : '';
  const register = useRegister(storeId, today);
  const isYesterdayUnclosed = useIsUnclosed(storeId, today ? addDays(today, -1) : '');
  const [asking, setAsking] = useState<Asking>(null);
  const pending = useRef<(() => void) | null>(null);
  const hasWarnedClosed = useRef(false);

  const status = register?.status ?? 'open';
  const runPending = () => {
    const next = pending.current;
    pending.current = null;
    setAsking(null);
    next?.();
  };
  const cancel = () => {
    pending.current = null;
    setAsking(null);
  };

  const guard = (next: () => void) => {
    if (status === 'open' || (status === 'closed' && hasWarnedClosed.current)) {
      next();
      return;
    }
    pending.current = next;
    setAsking(status === 'closed' ? 'closed' : 'open');
  };

  const banner =
    status === 'not_open' ? (
      <div className="flex items-center gap-2 border-b border-warn-200 bg-warn-50 py-1 pl-3 pr-1 text-[13px] text-warn-700 md:pl-5">
        <LockOpen aria-hidden size={17} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate py-2 font-semibold">{t('Kasir belum dibuka hari ini')}</span>
        <button type="button" onClick={() => setAsking('open')} className="h-10 shrink-0 rounded-lg px-3 font-semibold underline hover:bg-warn-200">
          {t('Buka kasir')}
        </button>
      </div>
    ) : status === 'closed' ? (
      <div className="flex items-center gap-2 border-b border-line bg-subtle py-1 pl-3 pr-1 text-[13px] text-ink-soft md:pl-5">
        <StoreIcon aria-hidden size={17} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate py-2">{t('Kasir hari ini sudah ditutup')}</span>
        <Link to={ROUTES.cash} className="flex h-10 shrink-0 items-center rounded-lg px-3 font-semibold text-brand-700 hover:bg-line">{t('Lihat Kas')}</Link>
      </div>
    ) : null;

  let sheet: ReactNode = null;
  if (asking === 'open' && store) {
    sheet = (
      <OpenRegisterSheet
        storeId={store.id}
        actorId={cashierId}
        businessDate={today}
        suggested={register?.suggestedOpening ?? 0}
        mode="open"
        isYesterdayUnclosed={isYesterdayUnclosed}
        onDone={runPending}
        onClose={cancel}
      />
    );
  } else if (asking === 'closed') {
    sheet = (
      <Sheet
        title={t('Kasir sudah ditutup')}
        isOpen
        onClose={cancel}
        footer={
          <div className="flex gap-2">
            <Link to={ROUTES.cash} className={btnSecondary}>{t('Ke Kas')}</Link>
            <button
              type="button"
              onClick={() => {
                hasWarnedClosed.current = true;
                runPending();
              }}
              className={`${btnPrimary} flex-1`}
            >
              {t('Tetap jual')}
            </button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-soft">{t('Penjualan setelah tutup kasir membuat hasil hitungan hari ini tidak cocok. Pemilik bisa membuka kembali kasir di halaman Kas, lalu menutupnya lagi.')}</p>
      </Sheet>
    );
  }

  return { banner, sheet, guard };
}

import { LockOpen, Store as StoreIcon } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { OpenRegisterSheet } from '../../components/Register/OpenRegisterSheet';
import { useIsUnclosed, useRegister } from '../../hooks/useCash';
import { getBusinessDate } from '../../lib/businessDate';
import { addDays } from '../../lib/dateRange';
import { formatClockTime, shiftNoOf } from '../../lib/shifts';
import type { Id, Store } from '../../types';
import { t } from '../../i18n';

interface RegisterGate {
  /** Slim bar above the menu while the register is not open, or already closed. */
  banner: ReactNode;
  /** The open-register sheet (first shift, or a new shift after a closing), when one is showing. */
  sheet: ReactNode;
  /** Runs `next` now when the register is open; otherwise asks first and runs it after (ADR-017). */
  guard: (next: () => void) => void;
}

/**
 * Register-open gate for the cashier (ADR-017). Local only: reads Dexie, never the network.
 * After a closing the same day it asks to open a new shift; the closed shift is never continued (ADR-027).
 * While the status is loading it lets the sale through, so a slow device never blocks selling.
 */
export function useRegisterGate(store: Store | undefined, cashierId: Id): RegisterGate {
  const storeId = store?.id ?? null;
  const today = store ? getBusinessDate(new Date(), store) : '';
  const register = useRegister(storeId, today);
  const isYesterdayUnclosed = useIsUnclosed(storeId, today ? addDays(today, -1) : '');
  const [isAsking, setIsAsking] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const status = register?.status ?? 'open';
  const runPending = () => {
    const next = pending.current;
    pending.current = null;
    setIsAsking(false);
    next?.();
  };
  const cancel = () => {
    pending.current = null;
    setIsAsking(false);
  };

  const guard = (next: () => void) => {
    if (status === 'open') {
      next();
      return;
    }
    pending.current = next;
    setIsAsking(true);
  };
  const last = register?.lastClosing ?? null;

  const banner =
    status === 'not_open' ? (
      <div className="flex items-center gap-2 border-b border-warn-200 bg-warn-50 py-1 pl-3 pr-1 text-[13px] text-warn-700 md:pl-5">
        <LockOpen aria-hidden size={17} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate py-2 font-semibold">{t('Kasir belum dibuka hari ini')}</span>
        <button type="button" onClick={() => setIsAsking(true)} className="h-10 shrink-0 rounded-lg px-3 font-semibold underline hover:bg-warn-200">
          {t('Buka kasir')}
        </button>
      </div>
    ) : status === 'closed' ? (
      <div className="flex items-center gap-2 border-b border-line bg-subtle py-1 pl-3 pr-1 text-[13px] text-ink-soft md:pl-5">
        <StoreIcon aria-hidden size={17} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate py-2">
          {last && store ? t('Shift {0} ditutup {1}', shiftNoOf(last), formatClockTime(last.closedAt, store.timezone)) : t('Kasir hari ini sudah ditutup')}
        </span>
        <button type="button" onClick={() => setIsAsking(true)} className="h-10 shrink-0 rounded-lg px-3 font-semibold text-brand-700 hover:bg-line">
          {t('Buka shift baru')}
        </button>
      </div>
    ) : null;

  const sheet: ReactNode =
    isAsking && store ? (
      <OpenRegisterSheet
        storeId={store.id}
        actorId={cashierId}
        businessDate={today}
        suggested={register?.suggestedOpening ?? 0}
        mode="open"
        shiftNo={register?.shiftNo ?? 1}
        lastClosing={last}
        timeZone={store.timezone}
        isYesterdayUnclosed={isYesterdayUnclosed}
        onDone={runPending}
        onClose={cancel}
      />
    ) : null;

  return { banner, sheet, guard };
}

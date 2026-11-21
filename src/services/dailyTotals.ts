import { version } from '../../package.json';
import { localDb } from '../db/localDb';
import { loadPeriodData } from '../hooks/usePeriodData';
import { getBusinessDate } from '../lib/businessDate';
import { dailyRows } from '../lib/dailyTotals';
import { addDays, datesInRange } from '../lib/dateRange';
import type { Id } from '../types';
import { BILLING_ENABLED, hasRefreshToken, postDailyTotals } from './account';

/**
 * Sends this store's daily totals to Pikul in the background (ADR-020). Never on the sell path, never shows an error:
 * offline or a failed call simply waits for the next trigger. First send covers 35 days, later sends the last 7.
 */
export const RECENT_DAYS = 7;
export const BACKFILL_DAYS = 35;
const BACKFILL_KEY = 'kk.dailyTotals.backfilled';

const flag = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: backfill again next time, harmless */
    }
  },
};

let running = false;

export async function sendDailyTotals(storeId: Id | null): Promise<boolean> {
  if (running || !storeId || !BILLING_ENABLED || !hasRefreshToken() || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;
  running = true;
  try {
    const store = await localDb.stores.get(storeId);
    if (!store) return false;
    const backfilled = flag.get(BACKFILL_KEY) === storeId;
    const today = getBusinessDate(new Date(), store);
    const range = { from: addDays(today, -((backfilled ? RECENT_DAYS : BACKFILL_DAYS) - 1)), to: today };
    const data = await loadPeriodData(storeId, range);
    const rows = dailyRows({ store, sales: data.sales, refunds: data.refundsInRange, ordersById: data.ordersById, memberName: data.memberName }, datesInRange(range), Date.now());
    await postDailyTotals({ appVersion: version, rows });
    if (!backfilled) flag.set(BACKFILL_KEY, storeId);
    return true;
  } catch {
    return false;
  } finally {
    running = false;
  }
}

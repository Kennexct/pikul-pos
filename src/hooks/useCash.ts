import { useLiveQuery } from 'dexie-react-hooks';
import { CLOSING_HISTORY_LIMIT } from '../constants';
import { localDb } from '../db/localDb';
import type { DrawerInput } from '../lib/cashDrawer';
import type { DateRange } from '../lib/dateRange';
import { isCountedSale } from '../lib/reports';
import { registerStatus, type RegisterStatus } from '../lib/register';
import { getClosing, getOpeningCash, hasOpening, loadDrawerInput } from '../services/dayClosing';
import { getDeviceId, isThisDevice } from '../services/device';
import type { BusinessDate, DayClosing, Expense, Id } from '../types';

export interface DrawerDay {
  input: DrawerInput;
  /** The live closing of the day, if it has been closed. */
  closing: DayClosing | null;
}

/** Everything the Kas screen shows for one business day; re-runs when sales, refunds, expenses or the closing change. */
export function useDrawerDay(storeId: Id | null, date: BusinessDate): DrawerDay | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return undefined;
    return { input: await loadDrawerInput(storeId, date), closing: (await getClosing(storeId, date)) ?? null };
  }, [storeId, date]);
}

/** True when that day has sales but nobody closed it. */
export function useIsUnclosed(storeId: Id | null, date: BusinessDate): boolean {
  return (
    useLiveQuery(async () => {
      if (!storeId || (await getClosing(storeId, date))) return false;
      const here = await getDeviceId();
      const sale = await localDb.orders.where('[storeId+businessDate]').equals([storeId, date]).filter((o) => isCountedSale(o) && isThisDevice(o, here)).first();
      return sale !== undefined;
    }, [storeId, date]) ?? false
  );
}

export interface RegisterInfo {
  status: RegisterStatus;
  /** What the opening sheet suggests: today's typed amount, else the last closing's opening cash. */
  suggestedOpening: number;
}

/** Live register state for one business day (ADR-017). Undefined while loading: callers never block on it. */
export function useRegister(storeId: Id | null, date: BusinessDate): RegisterInfo | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return undefined;
    const here = await getDeviceId();
    const sale = await localDb.orders.where('[storeId+businessDate]').equals([storeId, date]).filter((o) => isCountedSale(o) && isThisDevice(o, here)).first();
    const status = registerStatus({
      hasOpening: await hasOpening(storeId, date),
      hasCountedSale: sale !== undefined,
      hasClosing: (await getClosing(storeId, date)) !== undefined,
    });
    return { status, suggestedOpening: await getOpeningCash(storeId, date) };
  }, [storeId, date]);
}

/** Live expenses in the period, newest first. */
export function useExpenses(storeId: Id | null, range: DateRange): Expense[] | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return [];
    const rows = await localDb.expenses
      .where('[storeId+businessDate]')
      .between([storeId, range.from], [storeId, range.to], true, true)
      .filter((e) => !e.deletedAt)
      .toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [storeId, range.from, range.to]);
}

/** This device's recent closings, newest day first (ADR-025). */
export function useClosings(storeId: Id | null): DayClosing[] | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return [];
    const here = await getDeviceId();
    const rows = await localDb.dayClosings.where('storeId').equals(storeId).filter((c) => !c.deletedAt && isThisDevice(c, here)).toArray();
    return rows.sort((a, b) => b.businessDate.localeCompare(a.businessDate)).slice(0, CLOSING_HISTORY_LIMIT);
  }, [storeId]);
}

/** Display names of every member, including removed ones (they still appear on old records). */
export function useMemberNames(storeId: Id | null): ReadonlyMap<Id, string> {
  return (
    useLiveQuery(async () => {
      if (!storeId) return new Map<Id, string>();
      const members = await localDb.storeMembers.where('storeId').equals(storeId).toArray();
      return new Map(members.map((m) => [m.id, m.displayName]));
    }, [storeId]) ?? new Map<Id, string>()
  );
}

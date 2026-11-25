import { useLiveQuery } from 'dexie-react-hooks';
import { CLOSING_HISTORY_LIMIT } from '../constants';
import { localDb } from '../db/localDb';
import { buildDrawer, type Drawer, type DrawerInput } from '../lib/cashDrawer';
import type { DateRange } from '../lib/dateRange';
import { isCountedSale } from '../lib/reports';
import { registerStatus, type RegisterStatus } from '../lib/register';
import { currentShiftNo, shiftNoOf } from '../lib/shifts';
import { getClosings, hasOpening, loadDrawerInput } from '../services/dayClosing';
import { getDeviceId, isThisDevice } from '../services/device';
import type { BusinessDate, DayClosing, Expense, Id } from '../types';

export interface ShiftDrawer {
  shiftNo: number;
  drawer: Drawer;
  /** The shift's closing, or null while it is running. */
  closing: DayClosing | null;
}

export interface DrawerDay {
  /** The shift shown: the one asked for, else the running shift, else the last closed one. */
  shiftNo: number;
  input: DrawerInput;
  /** The shown shift's closing, if it has been closed. */
  closing: DayClosing | null;
  /** Every shift of the day so far, in order (ADR-027). A next shift appears once it is opened or has a sale. */
  shifts: ShiftDrawer[];
  /** The owner may reopen the shown closing: it is the last one and the next shift has not started. */
  canReopen: boolean;
}

/** The running shift has an opening count or a sale (ADR-017, ADR-027). */
async function isShiftStarted(storeId: Id, date: BusinessDate, shiftNo: number, input?: DrawerInput): Promise<boolean> {
  if (await hasOpening(storeId, date, shiftNo)) return true;
  return (input ?? (await loadDrawerInput(storeId, date, shiftNo))).sales.some(isCountedSale);
}

/** Everything the Kas screen shows for one business day; re-runs when sales, refunds, expenses or closings change. */
export function useDrawerDay(storeId: Id | null, date: BusinessDate, shiftNo: number | null = null): DrawerDay | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return undefined;
    const closings = await getClosings(storeId, date);
    const current = currentShiftNo(closings);
    const currentInput = await loadDrawerInput(storeId, date, current);
    const isRunning = closings.length === 0 || (await isShiftStarted(storeId, date, current, currentInput));
    const shifts: ShiftDrawer[] = [];
    for (const closing of closings) {
      shifts.push({ shiftNo: shiftNoOf(closing), drawer: buildDrawer(await loadDrawerInput(storeId, date, shiftNoOf(closing))), closing });
    }
    if (isRunning) shifts.push({ shiftNo: current, drawer: buildDrawer(currentInput), closing: null });

    const shown = shifts.find((s) => s.shiftNo === shiftNo) ?? shifts.at(-1);
    const shownNo = shown?.shiftNo ?? current;
    const input = shownNo === current ? currentInput : await loadDrawerInput(storeId, date, shownNo);
    const closing = shown?.closing ?? null;
    return { shiftNo: shownNo, input, closing, shifts, canReopen: closing !== null && closing === closings.at(-1) && !isRunning };
  }, [storeId, date, shiftNo]);
}

/** True when that day has sales after its last closing (or no closing at all): nobody closed them. */
export function useIsUnclosed(storeId: Id | null, date: BusinessDate): boolean {
  return (
    useLiveQuery(async () => {
      if (!storeId) return false;
      return (await loadDrawerInput(storeId, date)).sales.some(isCountedSale);
    }, [storeId, date]) ?? false
  );
}

export interface RegisterInfo {
  status: RegisterStatus;
  /** The shift that is running, or opens next. */
  shiftNo: number;
  /** What the opening sheet suggests: the shift's typed amount, else the previous shift's count, else the last day's opening. */
  suggestedOpening: number;
  /** The day's last closing, shown as "Shift 1 ditutup 14:05" before a new shift opens. */
  lastClosing: DayClosing | null;
}

/** Live register state for one business day (ADR-017, ADR-027). Undefined while loading: callers never block on it. */
export function useRegister(storeId: Id | null, date: BusinessDate): RegisterInfo | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return undefined;
    const closings = await getClosings(storeId, date);
    const shiftNo = currentShiftNo(closings);
    const input = await loadDrawerInput(storeId, date, shiftNo);
    const status = registerStatus({
      hasOpening: await hasOpening(storeId, date, shiftNo),
      hasCountedSale: input.sales.some(isCountedSale),
      closedShifts: closings.length,
    });
    return { status, shiftNo, suggestedOpening: input.openingCash, lastClosing: closings.at(-1) ?? null };
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

/** This device's recent closings, newest day and shift first (ADR-026, ADR-027). */
export function useClosings(storeId: Id | null): DayClosing[] | undefined {
  return useLiveQuery(async () => {
    if (!storeId) return [];
    const here = await getDeviceId();
    const rows = await localDb.dayClosings.where('storeId').equals(storeId).filter((c) => !c.deletedAt && isThisDevice(c, here)).toArray();
    return rows.sort((a, b) => b.businessDate.localeCompare(a.businessDate) || shiftNoOf(b) - shiftNoOf(a)).slice(0, CLOSING_HISTORY_LIMIT);
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

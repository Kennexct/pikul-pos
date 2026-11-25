import { describe, expect, it } from 'vitest';
import { currentShiftNo, isInWindow, saleTime, shiftNoOf, shiftWindow, sortShifts } from './shifts';

const closing = (shiftNo: number | undefined, closedAt: string, deletedAt: string | null = null) => ({ shiftNo, closedAt, deletedAt });

describe('shifts (ADR-027)', () => {
  it('treats a closing without a number as shift 1', () => {
    expect(shiftNoOf({})).toBe(1);
    expect(currentShiftNo([])).toBe(1);
    expect(currentShiftNo([closing(undefined, '2026-11-25T07:05:00.000Z')])).toBe(2);
  });

  it('ignores removed closings when counting and sorting', () => {
    const list = [closing(2, '2026-11-25T12:00:00.000Z'), closing(1, '2026-11-25T07:05:00.000Z'), closing(3, '2026-11-25T13:00:00.000Z', '2026-11-25T13:10:00.000Z')];
    expect(currentShiftNo(list)).toBe(3);
    expect(sortShifts(list).map((c) => c.shiftNo)).toEqual([1, 2]);
  });

  it('puts records after one closing and up to the next in that shift', () => {
    const list = [closing(1, '2026-11-25T07:05:00.000Z'), closing(2, '2026-11-25T12:00:00.000Z')];
    expect(shiftWindow(list, 1)).toEqual({ after: null, until: '2026-11-25T07:05:00.000Z' });
    expect(shiftWindow(list, 2)).toEqual({ after: '2026-11-25T07:05:00.000Z', until: '2026-11-25T12:00:00.000Z' });
    const running = shiftWindow(list, 3);
    expect(running).toEqual({ after: '2026-11-25T12:00:00.000Z', until: null });
    expect(isInWindow('2026-11-25T07:05:00.000Z', shiftWindow(list, 1))).toBe(true);
    expect(isInWindow('2026-11-25T07:05:00.001Z', shiftWindow(list, 1))).toBe(false);
    expect(isInWindow('2026-11-25T07:05:00.001Z', shiftWindow(list, 2))).toBe(true);
    expect(isInWindow('2026-11-25T12:30:00.000Z', running)).toBe(true);
  });

  it('counts a saved order when it is paid', () => {
    expect(saleTime({ createdAt: '2026-11-25T06:00:00.000Z', paidAt: '2026-11-25T09:00:00.000Z' })).toBe('2026-11-25T09:00:00.000Z');
    expect(saleTime({ createdAt: '2026-11-25T06:00:00.000Z', paidAt: null })).toBe('2026-11-25T06:00:00.000Z');
  });
});

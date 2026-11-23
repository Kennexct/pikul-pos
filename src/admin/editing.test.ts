import { describe, expect, it } from 'vitest';
import type { PlanDef } from './api';
import { blankPlanDraft, moveItem, moveSort, planPayload, planProblems, rowComplete, slugify, toPlanDraft } from './editing';

const plan = (id: string, sort: number, days = 30): PlanDef => ({ id, name: id, amount: 49_000, days, note: '', badge: '', features: ['A'], active: true, sort, updatedAt: 1 });

describe('read-only-first editors (ADR-024)', () => {
  it('makes a plan code from the name that the server accepts', () => {
    expect(slugify('Paket 3 Bulan!')).toBe('paket-3-bulan');
    expect(slugify('  Tahunan Hemat  ')).toBe('tahunan-hemat');
    expect(slugify('Kafé Ñ')).toBe('kafe-n');
    expect(slugify('x'.repeat(40))).toHaveLength(24);
    expect(slugify('Paket super panjang sekali ya-')).not.toMatch(/-$/);
  });

  it('keeps preset days as a choice and other days as custom', () => {
    expect(toPlanDraft(plan('a', 10, 90))).toMatchObject({ dayChoice: 90, customDays: '' });
    expect(toPlanDraft(plan('a', 10, 45))).toMatchObject({ dayChoice: 'other', customDays: '45' });
  });

  it('blocks invalid plans per field', () => {
    const d = blankPlanDraft(10);
    expect(planProblems(d, [], true)).toEqual({ id: 'id_format', name: 'name_required', amount: 'amount_range' });
    const ok = { ...d, id: 'tahunan', name: 'Tahunan', amount: 490_000, dayChoice: 365 };
    expect(planProblems(ok, [], true)).toEqual({});
    expect(planProblems(ok, ['tahunan'], true)).toEqual({ id: 'id_taken' });
    expect(planProblems({ ...ok, amount: 500 }, [], true)).toEqual({ amount: 'amount_range' });
    expect(planProblems({ ...ok, dayChoice: 'other', customDays: '' }, [], true)).toEqual({ days: 'days_range' });
    expect(planProblems({ ...ok, dayChoice: 'other', customDays: '2000' }, [], true)).toEqual({ days: 'days_range' });
    expect(planProblems({ ...ok, features: Array.from({ length: 9 }, (_, i) => `f${i}`) }, [], true)).toEqual({ features: 'features_max' });
  });

  it('does not check the code of an existing plan', () => {
    expect(planProblems({ ...toPlanDraft(plan('monthly', 10)), id: 'monthly' }, ['monthly'], false)).toEqual({});
  });

  it('sends trimmed features without empty lines and the chosen days', () => {
    const d = { ...toPlanDraft(plan('a', 10)), features: [' Satu ', '', '  '], dayChoice: 'other' as const, customDays: '45' };
    expect(planPayload(d, false)).toMatchObject({ features: ['Satu'], days: 45, isNew: false });
  });

  it('swaps sort with the neighbour', () => {
    const changed = moveSort([plan('a', 10), plan('b', 20), plan('c', 30)], 2, -1);
    expect(changed.map((p) => [p.id, p.sort])).toEqual([
      ['b', 30],
      ['c', 20],
    ]);
    expect(moveSort([plan('a', 10)], 0, -1)).toEqual([]);
  });

  it('spreads equal sort values before swapping', () => {
    const changed = moveSort([plan('a', 10), plan('b', 10)], 0, 1);
    expect(Object.fromEntries(changed.map((p) => [p.id, p.sort]))).toEqual({ a: 20 });
    // b moves from 10 → 10 (unchanged in value) and a from 10 → 20, so b now comes first.
  });

  it('moves landing rows and checks required text', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(rowComplete({ q: 'Apa?', a: ' ' }, ['q', 'a'])).toBe(false);
    expect(rowComplete({ q: 'Apa?', a: 'Ini.' }, ['q', 'a'])).toBe(true);
  });
});

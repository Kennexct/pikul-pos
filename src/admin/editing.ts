import { MAX_AMOUNT, MAX_DAYS, MIN_AMOUNT } from '../../server/catalog';
import type { PlanDef } from './api';

/** Pure helpers for the read-only-first editors (ADR-024). Rules mirror server/catalog.ts checkPlan. */

export const PLAN_ID = /^[a-z0-9][a-z0-9-]{1,23}$/;
export const DAY_CHOICES = [30, 90, 180, 365] as const;
export const MAX_FEATURES = 8;
export const FEATURE_MAX = 80;
export { MAX_AMOUNT, MAX_DAYS, MIN_AMOUNT };

/** "Paket 3 Bulan!" → "paket-3-bulan" (max 24 chars, server pattern). */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 24)
    .replace(/-+$/, '');
}

export interface PlanDraft {
  id: string;
  name: string;
  amount: number | null;
  /** A preset from DAY_CHOICES, or 'other' with `customDays`. */
  dayChoice: number | 'other';
  customDays: string;
  note: string;
  badge: string;
  features: string[];
  active: boolean;
  sort: number;
}

export const planDays = (d: Pick<PlanDraft, 'dayChoice' | 'customDays'>): number => (d.dayChoice === 'other' ? Number(d.customDays) || 0 : d.dayChoice);

export function toPlanDraft(p: PlanDef): PlanDraft {
  const preset = (DAY_CHOICES as readonly number[]).includes(p.days);
  return {
    id: p.id,
    name: p.name,
    amount: p.amount,
    dayChoice: preset ? p.days : 'other',
    customDays: preset ? '' : String(p.days),
    note: p.note,
    badge: p.badge,
    features: p.features.length ? [...p.features] : [''],
    active: p.active,
    sort: p.sort,
  };
}

export const blankPlanDraft = (sort: number): PlanDraft => ({ id: '', name: '', amount: null, dayChoice: 30, customDays: '', note: '', badge: '', features: [''], active: false, sort });

export type PlanField = 'id' | 'name' | 'amount' | 'days' | 'features';
export type PlanProblem = 'id_format' | 'id_taken' | 'name_required' | 'amount_range' | 'days_range' | 'features_max';

/** What stops this plan from saving, per field. Empty object = valid. */
export function planProblems(d: PlanDraft, otherIds: readonly string[], isNew: boolean): Partial<Record<PlanField, PlanProblem>> {
  const out: Partial<Record<PlanField, PlanProblem>> = {};
  if (isNew) {
    if (!PLAN_ID.test(d.id)) out.id = 'id_format';
    else if (otherIds.includes(d.id)) out.id = 'id_taken';
  }
  if (!d.name.trim()) out.name = 'name_required';
  if (d.amount === null || d.amount < MIN_AMOUNT || d.amount > MAX_AMOUNT) out.amount = 'amount_range';
  const days = planDays(d);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) out.days = 'days_range';
  if (cleanFeatures(d.features).length > MAX_FEATURES) out.features = 'features_max';
  return out;
}

export const cleanFeatures = (xs: readonly string[]) => xs.map((x) => x.trim()).filter(Boolean);

/** Body for savePlan. */
export const planPayload = (d: PlanDraft, isNew: boolean) => ({
  id: d.id,
  name: d.name.trim(),
  amount: d.amount ?? 0,
  days: planDays(d),
  note: d.note.trim(),
  badge: d.badge.trim(),
  features: cleanFeatures(d.features),
  active: d.active,
  sort: d.sort,
  isNew,
});

/** Plans in display order (sort, then id — same tie-break as the server list). */
export const byOrder = (plans: readonly PlanDef[]) => [...plans].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));

/**
 * Moving plan i (display order) by ±1: returns the plans whose sort changes, with new sort values.
 * Equal or crowded sort values are first spread to 10, 20, 30… so the swap always changes the order.
 */
export function moveSort(plans: readonly PlanDef[], i: number, by: -1 | 1): PlanDef[] {
  const list = byOrder(plans);
  const j = i + by;
  if (i < 0 || j < 0 || i >= list.length || j >= list.length) return [];
  const distinct = new Set(list.map((p) => p.sort)).size === list.length;
  const sorts = distinct ? list.map((p) => p.sort) : list.map((_, k) => (k + 1) * 10);
  const next = list.map((p, k) => ({ ...p, sort: sorts[k] ?? p.sort }));
  const a = next[i];
  const b = next[j];
  if (!a || !b) return [];
  [a.sort, b.sort] = [b.sort, a.sort];
  return next.filter((p, k) => p.sort !== list[k]?.sort);
}

/** True when every required text field of a landing row has text (all row fields are required by the server). */
export const rowComplete = (row: Record<string, unknown>, keys: readonly string[]) => keys.every((k) => typeof row[k] === 'string' && (row[k] as string).trim() !== '');

/** Swap item i with its neighbour; returns the same array when the move is out of range. */
export function moveItem<T>(xs: readonly T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= xs.length || i < 0 || i >= xs.length) return [...xs];
  const out = [...xs];
  const a = out[i] as T;
  out[i] = out[j] as T;
  out[j] = a;
  return out;
}

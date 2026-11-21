import { campaignState, checkCampaign, checkPlan, DEFAULT_PLANS } from '../../server/catalog';
import type { Campaign, PlanDef } from '../../server/types';

/**
 * Preview mode for /admin when no admin server answers (e.g. a static deploy without Pages Functions), ADR-019.
 * Uses the same checks as the server; data stays in this browser only and never reaches the landing page or the app.
 */
const KEY = 'kk.admin.preview';

interface Saved {
  plans: PlanDef[];
  campaigns: Campaign[];
}

export class PreviewError extends Error {}

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>;
      if (Array.isArray(v.plans) && Array.isArray(v.campaigns)) return { plans: v.plans, campaigns: v.campaigns };
    }
  } catch {
    /* storage blocked or corrupt: start from the seed plans */
  }
  return { plans: structuredClone([...DEFAULT_PLANS]), campaigns: [] };
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: changes last until the page closes */
  }
}

let state: Saved | null = null;
const db = () => (state ??= read());
const view = (c: Campaign, now: number) => ({ ...c, state: campaignState(c, now) });

export function previewCatalog() {
  const now = Date.now();
  const { plans, campaigns } = db();
  return {
    now,
    plans: [...plans].sort((x, y) => x.sort - y.sort || x.amount - y.amount),
    campaigns: campaigns
      .filter((c) => !c.archived)
      .sort((x, y) => y.startsAt - x.startsAt)
      .map((c) => view(c, now)),
  };
}

export function previewSavePlan(input: unknown) {
  const s = db();
  const checked = checkPlan(input, s.plans, Date.now());
  if (!checked.ok) throw new PreviewError(checked.error);
  s.plans = [...s.plans.filter((p) => p.id !== checked.value.id), checked.value];
  write(s);
  return { plan: checked.value };
}

function findLive(id: string): Campaign {
  const c = db().campaigns.find((x) => x.id === id);
  if (!c || c.archived) throw new PreviewError('not_found');
  return c;
}

function put(c: Campaign) {
  const s = db();
  s.campaigns = [...s.campaigns.filter((x) => x.id !== c.id), c];
  write(s);
}

export function previewSaveCampaign(id: string | null, input: unknown) {
  const now = Date.now();
  const prev = id ? findLive(id) : null;
  const checked = checkCampaign(input, db().plans, prev, crypto.randomUUID(), now);
  if (!checked.ok) throw new PreviewError(checked.error);
  put(checked.value);
  return { campaign: view(checked.value, now) };
}

export function previewToggleCampaign(id: string, enabled: boolean) {
  const now = Date.now();
  const next = { ...findLive(id), enabled, updatedAt: now };
  put(next);
  return { campaign: view(next, now) };
}

export function previewArchiveCampaign(id: string) {
  put({ ...findLive(id), archived: true, enabled: false, updatedAt: Date.now() });
  return { ok: true as const };
}

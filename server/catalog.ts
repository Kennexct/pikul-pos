import type { Campaign, PlanDef } from './types';

/** Seed plans (same as migration 002). Prices are placeholders until Kenny sets them in /admin. */
export const DEFAULT_PLANS: readonly PlanDef[] = [
  {
    id: 'monthly',
    name: 'Bulanan',
    amount: 49_000,
    days: 30,
    note: 'Lanjut setelah masa coba. Bayar dengan QRIS, VA, GoPay, atau ShopeePay.',
    badge: '',
    features: ['Semua fitur di masa coba', 'Perpanjang kapan saja, tanpa hari hilang', 'Data tetap milik Anda'],
    active: true,
    sort: 10,
    updatedAt: 0,
  },
  {
    id: 'yearly',
    name: 'Tahunan',
    amount: 490_000,
    days: 365,
    note: 'Hemat dua bulan dibanding bayar bulanan.',
    badge: 'Hemat 2 bulan',
    features: ['Semua fitur di masa coba', 'Sekali bayar untuk setahun', 'Data tetap milik Anda'],
    active: true,
    sort: 20,
    updatedAt: 0,
  },
];

export const MIN_AMOUNT = 1_000;
export const MAX_AMOUNT = 100_000_000;
export const MAX_DAYS = 1_095;
const PLAN_ID = /^[a-z0-9][a-z0-9-]{1,23}$/;

type Fields = Record<string, unknown>;
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = <T>(error: string): Checked<T> => ({ ok: false, error });

/** Public shape of a pop-up (no internal name, schedule start or promo internals). */
export const popupView = (c: Campaign) => ({ id: c.id, title: c.title, body: c.body, imageUrl: c.imageUrl, linkUrl: c.linkUrl, ctaLabel: c.ctaLabel, endsAt: c.endsAt });

/** Trimmed single-line text within a length, or null. Control characters are refused. */
function text(v: unknown, max: number, allowEmpty = false): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s)) return null;
  if (s.length > max || (!allowEmpty && s.length === 0)) return null;
  return s;
}
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max ? v : null);

/** A link the landing page may open: a site path ("/app/") or an https URL. */
export function safeUrl(v: unknown, max = 500): string | null {
  const s = text(v, max);
  if (!s) return null;
  if (/^\/(?!\/)[^\s\\]*$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Validates a plan from the console. `existing` keeps the id fixed and refuses taking another plan's id. */
export function checkPlan(input: unknown, plans: readonly PlanDef[], now: number): Checked<PlanDef> {
  const f = (input ?? {}) as Fields;
  const id = typeof f.id === 'string' ? f.id.trim().toLowerCase() : '';
  if (!PLAN_ID.test(id)) return fail('invalid_plan_id');
  const name = text(f.name, 40);
  if (!name) return fail('invalid_name');
  const amount = int(f.amount, MIN_AMOUNT, MAX_AMOUNT);
  if (amount === null) return fail('invalid_amount');
  const days = int(f.days, 1, MAX_DAYS);
  if (days === null) return fail('invalid_days');
  const note = text(f.note ?? '', 200, true);
  const badge = text(f.badge ?? '', 24, true);
  if (note === null || badge === null) return fail('invalid_text');
  if (!Array.isArray(f.features) || f.features.length > 8) return fail('invalid_features');
  const features: string[] = [];
  for (const x of f.features) {
    const line = text(x, 80, true);
    if (line === null) return fail('invalid_features');
    if (line) features.push(line);
  }
  if (typeof f.active !== 'boolean') return fail('invalid_active');
  const sort = int(f.sort ?? 0, 0, 9_999);
  if (sort === null) return fail('invalid_sort');
  const isNew = !plans.some((p) => p.id === id);
  if (isNew && f.isNew !== true) return fail('not_found');
  if (!isNew && f.isNew === true) return fail('plan_exists');
  return { ok: true, value: { id, name, amount, days, note, badge, features, active: f.active, sort, updatedAt: now } };
}

/** Validates a campaign from the console. The promo plan must exist and the promo must be below its price. */
export function checkCampaign(input: unknown, plans: readonly PlanDef[], prev: Campaign | null, newId: string, now: number): Checked<Campaign> {
  const f = (input ?? {}) as Fields;
  const name = text(f.name, 60);
  const title = text(f.title, 80);
  const body = typeof f.body === 'string' && f.body.trim().length <= 400 && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(f.body) ? f.body.trim() : null;
  if (!name || !title || body === null) return fail('invalid_text');
  const optionalUrl = (v: unknown) => (v === null || v === undefined || v === '' ? { ok: true, url: null } : { ok: safeUrl(v) !== null, url: safeUrl(v) });
  const image = optionalUrl(f.imageUrl);
  if (!image.ok) return fail('invalid_image');
  const link = optionalUrl(f.linkUrl);
  if (!link.ok) return fail('invalid_link');
  const ctaLabel = text(f.ctaLabel ?? '', 30, true);
  if (ctaLabel === null) return fail('invalid_cta');
  if (typeof f.showOnLanding !== 'boolean' || typeof f.showInApp !== 'boolean') return fail('invalid_placement');
  if (!f.showOnLanding && !f.showInApp) return fail('no_placement');
  const startsAt = int(f.startsAt, 0, 8_640_000_000_000);
  const endsAt = int(f.endsAt, 0, 8_640_000_000_000);
  if (startsAt === null || endsAt === null || endsAt <= startsAt) return fail('invalid_dates');
  if (typeof f.enabled !== 'boolean') return fail('invalid_enabled');
  let planId: string | null = null;
  let promoAmount: number | null = null;
  if (f.planId !== null && f.planId !== undefined && f.planId !== '') {
    const plan = plans.find((p) => p.id === f.planId);
    if (!plan) return fail('invalid_plan');
    promoAmount = int(f.promoAmount, MIN_AMOUNT, plan.amount - 1);
    if (promoAmount === null) return fail('invalid_promo');
    planId = plan.id;
  }
  return {
    ok: true,
    value: {
      id: prev?.id ?? newId,
      name,
      title,
      body,
      imageUrl: image.url,
      linkUrl: link.url,
      ctaLabel: link.url ? ctaLabel : '',
      showOnLanding: f.showOnLanding,
      showInApp: f.showInApp,
      startsAt,
      endsAt,
      enabled: f.enabled,
      archived: false,
      planId,
      promoAmount,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

export const isLive = (c: Campaign, now: number) => c.enabled && !c.archived && c.startsAt <= now && now < c.endsAt;

export type CampaignState = 'live' | 'scheduled' | 'ended' | 'off';
export const campaignState = (c: Campaign, now: number): CampaignState =>
  !c.enabled ? 'off' : now < c.startsAt ? 'scheduled' : now >= c.endsAt ? 'ended' : 'live';

/** What a plan costs right now: the lowest live promo for it, else its normal price. */
export function priceNow(plan: PlanDef, campaigns: readonly Campaign[], now: number): { amount: number; campaign: Campaign | null } {
  let best: Campaign | null = null;
  for (const c of campaigns) {
    if (c.planId !== plan.id || c.promoAmount === null || !isLive(c, now)) continue;
    if (c.promoAmount < plan.amount && (!best || c.promoAmount < (best.promoAmount ?? Infinity))) best = c;
  }
  return best ? { amount: best.promoAmount!, campaign: best } : { amount: plan.amount, campaign: null };
}

/** The pop-up to show in one place: the live campaign for it that started last. */
export function popupNow(campaigns: readonly Campaign[], now: number, where: 'landing' | 'app'): Campaign | null {
  return campaigns.filter((c) => isLive(c, now) && (where === 'landing' ? c.showOnLanding : c.showInApp)).sort((a, b) => b.startsAt - a.startsAt || b.updatedAt - a.updatedAt)[0] ?? null;
}

export interface PlanOffer {
  id: string;
  name: string;
  days: number;
  amount: number; // charged now
  regularAmount: number;
  promoEndsAt: number | null;
  note: string;
  badge: string;
  features: string[];
}

/** Active plans in display order with today's price — shared by the landing data and the app's billing overview. */
export function offers(plans: readonly PlanDef[], campaigns: readonly Campaign[], now: number): PlanOffer[] {
  return plans
    .filter((p) => p.active)
    .sort((a, b) => a.sort - b.sort || a.amount - b.amount)
    .map((p) => {
      const { amount, campaign } = priceNow(p, campaigns, now);
      return { id: p.id, name: p.name, days: p.days, amount, regularAmount: p.amount, promoEndsAt: campaign?.endsAt ?? null, note: p.note, badge: p.badge, features: p.features };
    });
}

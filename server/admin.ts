import { isResponse, requireAdmin } from './adminAuth';
import { campaignState, checkCampaign, checkPlan, offers, popupNow, popupView } from './catalog';
import { sniffImage } from './images';
import { TRIAL_DAYS, type ApiResponse, type Campaign, type Deps } from './types';

const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });

const campaignView = (c: Campaign, now: number) => ({ ...c, state: campaignState(c, now) });

export async function adminMe(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  return { status: 200, body: { actor: a.actor } };
}

export async function adminCatalog(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const [plans, campaigns] = await Promise.all([deps.repo.listPlans(), deps.repo.listCampaigns()]);
  return {
    status: 200,
    body: {
      now,
      plans: [...plans].sort((x, y) => x.sort - y.sort || x.amount - y.amount),
      campaigns: [...campaigns].sort((x, y) => y.startsAt - x.startsAt).map((c) => campaignView(c, now)),
    },
  };
}

export async function adminSavePlan(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const checked = checkPlan(body, await deps.repo.listPlans(), now);
  if (!checked.ok) return bad(checked.error, checked.error === 'not_found' ? 404 : 400);
  await deps.repo.putPlan(checked.value);
  await deps.repo.addAudit({ at: now, email: a.actor, action: 'plan.save', target: checked.value.id, detail: checked.value });
  return { status: 200, body: { plan: checked.value }, purgePublic: true };
}

export async function adminSaveCampaign(deps: Deps, auth: string | null, id: string | null, body: unknown): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const now = deps.now();
  const prev = id ? await deps.repo.findCampaign(id) : null;
  if (id && (!prev || prev.archived)) return bad('not_found', 404);
  const checked = checkCampaign(body, await deps.repo.listPlans(), prev, crypto.randomUUID(), now);
  if (!checked.ok) return bad(checked.error);
  await deps.repo.putCampaign(checked.value);
  await deps.repo.addAudit({ at: now, email: a.actor, action: prev ? 'campaign.update' : 'campaign.create', target: checked.value.id, detail: checked.value });
  return { status: 200, body: { campaign: campaignView(checked.value, now) }, purgePublic: true };
}

/** Quick on/off from the list. */
export async function adminToggleCampaign(deps: Deps, auth: string | null, id: string, body: unknown): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const enabled = (body as { enabled?: unknown })?.enabled;
  if (typeof enabled !== 'boolean') return bad('invalid_enabled');
  const prev = await deps.repo.findCampaign(id);
  if (!prev || prev.archived) return bad('not_found', 404);
  const now = deps.now();
  const next = { ...prev, enabled, updatedAt: now };
  await deps.repo.putCampaign(next);
  await deps.repo.addAudit({ at: now, email: a.actor, action: enabled ? 'campaign.on' : 'campaign.off', target: id, detail: null });
  return { status: 200, body: { campaign: campaignView(next, now) }, purgePublic: true };
}

/** Delete = archive: hidden everywhere, kept for payments that used its promo. */
export async function adminArchiveCampaign(deps: Deps, auth: string | null, id: string): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const prev = await deps.repo.findCampaign(id);
  if (!prev || prev.archived) return bad('not_found', 404);
  const now = deps.now();
  await deps.repo.putCampaign({ ...prev, archived: true, enabled: false, updatedAt: now });
  await deps.repo.addAudit({ at: now, email: a.actor, action: 'campaign.archive', target: id, detail: null });
  return { status: 200, body: { ok: true }, purgePublic: true };
}

/** Banner upload: JSON {data: base64}. PNG, JPEG or WebP up to 500 KB, checked by magic bytes. */
export async function adminUploadImage(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await requireAdmin(deps, auth);
  if (isResponse(a)) return a;
  const b64 = (body as { data?: unknown })?.data;
  if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return bad('invalid_image');
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  if (bytes.length > MAX_IMAGE_BYTES) return bad('image_too_large', 413);
  const mime = sniffImage(bytes);
  if (!mime) return bad('invalid_image');
  const now = deps.now();
  const id = crypto.randomUUID();
  await deps.repo.putImage({ id, mime, data: bytes, createdAt: now });
  await deps.repo.addAudit({ at: now, email: a.actor, action: 'image.upload', target: id, detail: { mime, bytes: bytes.length } });
  return { status: 200, body: { url: `/api/public/images/${id}` } };
}
export const MAX_IMAGE_BYTES = 500_000;

export async function publicImage(deps: Deps, id: string): Promise<ApiResponse> {
  const img = await deps.repo.getImage(id);
  if (!img) return bad('not_found', 404);
  return { status: 200, body: null, raw: { contentType: img.mime, bytes: img.data }, cacheSeconds: 86_400 };
}

/** Public data for the landing page: plans with today's price and the live landing pop-up. Edge-cached. */
export async function landingData(deps: Deps): Promise<ApiResponse> {
  const now = deps.now();
  const [plans, campaigns] = await Promise.all([deps.repo.listPlans(), deps.repo.listCampaigns()]);
  const c = popupNow(campaigns, now, 'landing');
  return { status: 200, cacheSeconds: 60, body: { trialDays: TRIAL_DAYS, plans: offers(plans, campaigns, now), popup: c ? popupView(c) : null } };
}

/** The live pop-ups for the merchant app: once per account, and on the first register opening of a day (ADR-020). Edge-cached. */
export async function appPopupData(deps: Deps): Promise<ApiResponse> {
  const now = deps.now();
  const campaigns = await deps.repo.listCampaigns();
  const c = popupNow(campaigns, now, 'app');
  const r = popupNow(campaigns, now, 'register');
  return { status: 200, cacheSeconds: 60, body: { popup: c ? popupView(c) : null, registerPopup: r ? popupView(r) : null } };
}

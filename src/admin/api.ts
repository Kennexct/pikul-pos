import type { CampaignState, Checked } from '../../server/catalog';
import type { Campaign, PlanDef } from '../../server/types';
import { previewArchiveCampaign, previewCatalog, PreviewError, previewSaveCampaign, previewSavePlan, previewToggleCampaign } from './previewStore';

/**
 * Admin console API. Sign-in is removed for now (ADR-019): the server must run with ADMIN_OPEN=1.
 * When no admin server answers, the console runs in preview mode (previewStore.ts, this browser only).
 */
export type { PlanDef, Campaign, CampaignState, Checked };
export type CampaignRow = Campaign & { state: CampaignState };
export interface Catalog {
  now: number;
  plans: PlanDef[];
  campaigns: CampaignRow[];
}

export class AdminError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

/** server = changes are live; locked = server still wants sign-in (ADMIN_OPEN not set); no_server = nothing at /api. */
export type Mode = 'server' | 'locked' | 'no_server';
let mode: Mode = 'server';
const preview = () => mode !== 'server';

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new AdminError('offline', 0);
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AdminError(json.error ?? 'server_error', res.status);
  return json;
}

/** Runs a preview action and turns its check errors into AdminError, like the server's 400s. */
function local<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e instanceof PreviewError ? new AdminError(e.message, 400) : e);
  }
}

const isCatalog = (v: unknown): v is Catalog => !!v && Array.isArray((v as Catalog).plans) && Array.isArray((v as Catalog).campaigns);

/** First load: use the server when it answers with a catalog, else fall back to preview mode. */
export async function openConsole(): Promise<{ mode: Mode; catalog: Catalog }> {
  try {
    const c = await call<unknown>('GET', '/api/admin/catalog');
    if (isCatalog(c)) return { mode: (mode = 'server'), catalog: c };
    mode = 'no_server';
  } catch (e) {
    if (e instanceof AdminError && e.code === 'offline') throw e;
    mode = e instanceof AdminError && (e.status === 401 || e.status === 403) ? 'locked' : 'no_server';
  }
  return { mode, catalog: previewCatalog() };
}

export const loadCatalog = () => (preview() ? local(previewCatalog) : call<Catalog>('GET', '/api/admin/catalog'));
export const savePlan = (p: Omit<PlanDef, 'updatedAt'> & { isNew?: boolean }) =>
  preview() ? local(() => previewSavePlan(p)) : call<{ plan: PlanDef }>('POST', '/api/admin/plans', p);
export type CampaignInput = Omit<Campaign, 'id' | 'archived' | 'createdAt' | 'updatedAt'>;
export const saveCampaign = (id: string | null, c: CampaignInput) =>
  preview() ? local(() => previewSaveCampaign(id, c)) : call<{ campaign: CampaignRow }>('POST', id ? `/api/admin/campaigns/${id}` : '/api/admin/campaigns', c);
export const toggleCampaign = (id: string, enabled: boolean) =>
  preview() ? local(() => previewToggleCampaign(id, enabled)) : call<{ campaign: CampaignRow }>('POST', `/api/admin/campaigns/${id}/toggle`, { enabled });
export const archiveCampaign = (id: string) => (preview() ? local(() => previewArchiveCampaign(id)) : call<{ ok: true }>('POST', `/api/admin/campaigns/${id}/archive`, {}));

export async function uploadImage(file: File): Promise<string> {
  if (preview()) throw new AdminError('preview_upload', 400);
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return (await call<{ url: string }>('POST', '/api/admin/images', { data: btoa(bin) })).url;
}

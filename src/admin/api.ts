import type { CampaignState, Checked } from '../../server/catalog';
import type { Campaign, PlanDef } from '../../server/types';

/** Admin console API (ADR-014). The session lives in sessionStorage: closing the tab signs out. */
const KEY = 'kk.admin.refresh';
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

const token = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const hasSession = () => token() !== null;
export function setSession(refreshToken: string | null) {
  try {
    if (refreshToken) sessionStorage.setItem(KEY, refreshToken);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: session lasts this page only */
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${token() ?? ''}`;
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

export const requestCode = (email: string) => call<{ ok: true }>('POST', '/api/auth/code', { email }, false);
export async function verifyCode(email: string, code: string) {
  const s = await call<{ refreshToken: string }>('POST', '/api/auth/verify', { email, code }, false);
  setSession(s.refreshToken);
}
export async function signOut() {
  const t = token();
  setSession(null);
  if (t) await call('POST', '/api/auth/signout', { refreshToken: t }, false).catch(() => undefined);
}

export const me = () => call<{ email: string }>('GET', '/api/admin/me');
export const loadCatalog = () => call<Catalog>('GET', '/api/admin/catalog');
export const savePlan = (p: Omit<PlanDef, 'updatedAt'> & { isNew?: boolean }) => call<{ plan: PlanDef }>('POST', '/api/admin/plans', p);
export type CampaignInput = Omit<Campaign, 'id' | 'archived' | 'createdAt' | 'updatedAt'>;
export const saveCampaign = (id: string | null, c: CampaignInput) => call<{ campaign: CampaignRow }>('POST', id ? `/api/admin/campaigns/${id}` : '/api/admin/campaigns', c);
export const toggleCampaign = (id: string, enabled: boolean) => call<{ campaign: CampaignRow }>('POST', `/api/admin/campaigns/${id}/toggle`, { enabled });
export const archiveCampaign = (id: string) => call<{ ok: true }>('POST', `/api/admin/campaigns/${id}/archive`, {});

export async function uploadImage(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return (await call<{ url: string }>('POST', '/api/admin/images', { data: btoa(bin) })).url;
}

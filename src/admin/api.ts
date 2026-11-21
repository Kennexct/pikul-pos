import type { CampaignState, Checked } from '../../server/catalog';
import type { Campaign, PlanDef } from '../../server/types';
import type { Grant, Payment, SiteContent } from '../../server/adminTypes';
import type { AccountView } from '../../server/merchants';
import type { MerchantSummary, ExecutiveReport } from '../../server/analytics';
import type { PlanOffer } from '../../server/catalog';

/**
 * Admin console API (ADR-020): admin password → bearer token in sessionStorage.
 * There is no preview or example data (ADR-022): without an API server the console says so and stops.
 */
export type { PlanDef, Campaign, CampaignState, Checked, Grant, Payment, SiteContent, AccountView, MerchantSummary, ExecutiveReport, PlanOffer };
export type CampaignRow = Campaign & { state: CampaignState };
export interface Catalog {
  now: number;
  plans: PlanDef[];
  campaigns: CampaignRow[];
}

export class AdminError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

/** ready = signed in; login = needs the password; disabled = server has no ADMIN_PASSWORD; no_server = no API answered. */
export type Gate = 'ready' | 'login' | 'disabled' | 'no_server';
export const SIGNED_OUT_EVENT = 'pikul-admin-signed-out';
const TOKEN_KEY = 'pikul.admin';

const store = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) sessionStorage.setItem(TOKEN_KEY, v);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked: the session lasts until reload */
    }
  },
};
const token = () => store.get();

interface Raw {
  status: number;
  body: unknown;
  text?: { content: string; filename?: string };
}

async function serverFetch(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Raw> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const tk = token();
  if (tk) headers.Authorization = `Bearer ${tk}`;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new AdminError('offline', 0);
  }
  const type = res.headers.get('Content-Type') ?? '';
  if (type.startsWith('text/csv')) {
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1];
    return { status: res.status, body: null, text: { content: await res.text(), filename: name } };
  }
  return { status: res.status, body: type.includes('json') ? await res.json().catch(() => null) : null };
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const r = await serverFetch(method, path, body);
  if (r.status >= 200 && r.status < 300) return (r.text ?? r.body) as T;
  const code = (r.body as { error?: string } | null)?.error ?? 'server_error';
  if (r.status === 401 && path !== '/api/admin/login') {
      store.set(null);
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  throw new AdminError(code, r.status);
}

/** First load: is there an admin server, and is this tab signed in? */
export async function openConsole(): Promise<{ gate: Gate }> {
  const r = await serverFetch('GET', '/api/admin/me');
  const err = (r.body as { error?: string } | null)?.error;
  if (r.status === 200 && (r.body as { actor?: unknown } | null)?.actor) return { gate: 'ready' };
  if (r.status === 401 && err) return { gate: 'login' };
  if (r.status === 503 && err === 'admin_disabled') return { gate: 'disabled' };
  return { gate: 'no_server' };
}

export async function login(password: string): Promise<void> {
  const r = await call<{ token: string }>('POST', '/api/admin/login', { password });
  store.set(r.token);
}
export async function logout(): Promise<void> {
  await call('POST', '/api/admin/logout', {}).catch(() => undefined);
  store.set(null);
}

// ---------- plans and campaigns (ADR-014) ----------
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

// ---------- business console (ADR-020) ----------
export type FollowUp = AccountView & { reason: 'trial_ending' | 'paid_ending' | 'lapsed' };
export interface PlanCount {
  key: string;
  label: string | null;
  count: number;
}
export interface Overview {
  now: number;
  counts: { total: number; paid: number; trial: number; expired: number; signups7: number; signups30: number };
  conversion: { eligible: number; converted: number };
  revenue: { month: string; thisMonth: number; lastMonth: number };
  sales: { today: { transactions: number; net: number; merchants: number }; week: { transactions: number; net: number; merchants: number }; stopped: number };
  plans: PlanCount[];
  followUps: FollowUp[];
}
export interface MerchantPage {
  now: number;
  total: number;
  page: number;
  pageSize: number;
  rows: AccountView[];
  plans: PlanCount[];
}
export interface MerchantDetail {
  now: number;
  merchant: AccountView;
  payments: Payment[];
  grants: Grant[];
  offers: PlanOffer[];
  today: string;
}
export type PaymentRow = Payment & { email: string; planName: string | null };
export interface PaymentMonth {
  month: string;
  rows: PaymentRow[];
  total: number;
  count: number;
  cancelled: number;
}
export type PaymentInput = Pick<Payment, 'planId' | 'amount' | 'days' | 'method' | 'reference' | 'paidOn' | 'note'>;

const qs = (q: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const loadOverview = () => call<Overview>('GET', '/api/admin/overview');
export const loadMerchants = (q: { q?: string; filter?: string; plan?: string; page?: number }) => call<MerchantPage>('GET', `/api/admin/merchants${qs(q)}`);
export const loadMerchant = (id: string) => call<MerchantDetail>('GET', `/api/admin/merchants/${id}`);
export const recordPayment = (id: string, p: PaymentInput) => call<{ payment: Payment }>('POST', `/api/admin/merchants/${id}/payments`, p);
export const cancelPayment = (id: string, reason: string) => call<{ ok: true }>('POST', `/api/admin/payments/${id}/cancel`, { reason });
export const tempPassword = (id: string) => call<{ password: string }>('POST', `/api/admin/merchants/${id}/temp-password`, {});
export const merchantsCsvPath = (q: { q?: string; filter?: string; plan?: string }) => `/api/admin/merchants${qs({ ...q, format: 'csv' })}`;
export const grantTrial = (id: string, days: number, reason: string) => call<{ grant: Grant }>('POST', `/api/admin/merchants/${id}/grants`, { days, reason });
export const loadPayments = (month: string) => call<PaymentMonth>('GET', `/api/admin/payments${qs({ month })}`);
export const loadMerchantSummary = (id: string, from: string, to: string) => call<MerchantSummary>('GET', `/api/admin/merchants/${id}/summary${qs({ from, to })}`);
export const loadReport = (from: string, to: string) => call<ExecutiveReport>('GET', `/api/admin/report${qs({ from, to })}`);
export const loadContent = () => call<{ content: SiteContent; isDefault: boolean }>('GET', '/api/admin/content');
export const saveContent = (c: Omit<SiteContent, 'updatedAt'>) => call<{ content: SiteContent }>('POST', '/api/admin/content', c);
export const resetContent = () => call<{ content: SiteContent }>('POST', '/api/admin/content/reset', {});

/** Downloads a CSV export (payments or report) through the same auth as the API. */
export async function downloadCsv(path: string, fallbackName: string): Promise<void> {
  const r = await call<{ content: string; filename?: string } | null>('GET', path);
  if (!r || typeof r !== 'object' || !('content' in r)) throw new AdminError('server_error', 500);
  const url = URL.createObjectURL(new Blob([r.content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = r.filename ?? fallbackName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

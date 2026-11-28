import type { JWK } from 'jose';
import { accessState, monotonicNow, verifyPass, type AccessState, type PassClaims } from '../lib/accessPass';

const K = { pass: 'kk.pass', refresh: 'kk.refresh', lastSeen: 'kk.lastSeen', signupStore: 'kk.signupStore' } as const;

const publicJwk: JWK | null = (() => {
  const raw = import.meta.env.VITE_PASS_PUBLIC_JWK as string | undefined;
  try {
    return raw ? (JSON.parse(raw) as JWK) : null;
  } catch {
    return null;
  }
})();

/** ADR-013: billing is on only when the app was built with the server's public key and not switched off. */
export const BILLING_ENABLED = publicJwk !== null && import.meta.env.VITE_BILLING !== 'off';
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || null;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode: session-only */
  }
};

export function deviceNow(): number {
  const now = monotonicNow(Date.now(), Number(read(K.lastSeen)) || 0);
  write(K.lastSeen, String(now));
  return now;
}

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown, auth?: boolean): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers.Authorization = `Bearer ${read(K.refresh) ?? ''}`;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('offline', 0);
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(json.error ?? 'server_error', res.status);
  return json;
}

interface SessionBody {
  pass: string;
  refreshToken: string;
}

async function keep(s: SessionBody): Promise<PassClaims> {
  const claims = publicJwk ? await verifyPass(s.pass, publicJwk) : null;
  if (!claims) throw new ApiError('bad_pass', 500);
  write(K.pass, s.pass);
  write(K.refresh, s.refreshToken);
  return claims;
}

/** Signed-in API call for other services (device sync, ADR-025). */
export const accountApi = <T>(method: 'GET' | 'POST', path: string, body?: unknown, auth?: boolean): Promise<T> => api<T>(method, path, body, auth);

export async function loadStoredPass(): Promise<PassClaims | null> {
  const p = read(K.pass);
  return p && publicJwk ? verifyPass(p, publicJwk) : null;
}

export const hasRefreshToken = () => read(K.refresh) !== null;
export const stateOf = (c: PassClaims): AccessState => accessState(c, deviceNow());

/** What the sign-up page collects (ADR-023); the admin console shows it under Merchant. */
export interface SignUpInput {
  email: string;
  password: string;
  ownerName: string;
  storeName: string;
  phone: string;
  city: string;
}
export const authOptions = () => api<{ emailReset: boolean; google: boolean; receiptEmail?: boolean }>('GET', '/api/auth/options');
export async function signUp(input: SignUpInput): Promise<PassClaims> {
  const claims = await keep(await api<SessionBody>('POST', '/api/auth/signup', input));
  write(K.signupStore, input.storeName.trim());
  return claims;
}
export const passwordSignIn = async (email: string, password: string) => keep(await api<SessionBody>('POST', '/api/auth/login', { email, password }));
export const resetPassword = async (email: string, code: string, password: string) => keep(await api<SessionBody>('POST', '/api/auth/reset', { email, code, password }));
/** Settings: other devices are signed out; this one keeps going with a new session. */
export const changePassword = async (current: string, password: string) => keep(await api<SessionBody>('POST', '/api/auth/password', { current, password }, true));
/** The store name typed at sign-up on this device, to prefill the first-time setup. */
export const signupStoreName = (): string => read(K.signupStore) ?? '';

export const requestCode = (email: string) => api<{ ok: true }>('POST', '/api/auth/code', { email });
export const verifyCode = async (email: string, code: string) => keep(await api<SessionBody>('POST', '/api/auth/verify', { email, code }));
export const googleSignIn = async (idToken: string) => keep(await api<SessionBody>('POST', '/api/auth/google', { idToken }));

/** New pass with the server's current entitlement. Throws ApiError('signed_out', 401) when the session is gone. */
export async function refreshPass(): Promise<PassClaims> {
  const refreshToken = read(K.refresh);
  if (!refreshToken) throw new ApiError('signed_out', 401);
  return keep(await api<SessionBody>('POST', '/api/auth/refresh', { refreshToken }));
}

export async function signOut(): Promise<void> {
  const refreshToken = read(K.refresh);
  write(K.pass, null);
  write(K.refresh, null);
  if (refreshToken) await api('POST', '/api/auth/signout', { refreshToken }).catch(() => undefined);
}

export interface BillingOverview {
  account: { email: string; plan: 'trial' | 'paid'; until: number; trialEndsAt: number; paidUntil: number | null };
  plans: PlanOffer[];
}
/** A plan as set in the admin console, with today's display price (ADR-014). No payment provider is connected (ADR-015). */
export interface PlanOffer {
  id: string;
  name: string;
  days: number;
  amount: number;
  regularAmount: number;
  promoEndsAt: number | null;
  note: string;
  badge: string;
  features: string[];
}
export interface CampaignPopup {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string;
  endsAt: number;
}
export const billingOverview = () => api<BillingOverview>('GET', '/api/billing', undefined, true);
/** The live in-app campaigns, if any (public, cached at the edge for a minute): once per account, and on register open (ADR-020). */
export const appCampaign = () => api<{ popup: CampaignPopup | null; registerPopup?: CampaignPopup | null }>('GET', '/api/public/app');
/** Daily sales totals for this account (ADR-020). Bearer = refresh token; never rotates it. */
export const postDailyTotals = (body: { appVersion: string; rows: unknown[] }) => api<{ ok: true; saved: number }>('POST', '/api/merchant/daily', body, true);

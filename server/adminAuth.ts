import { randomToken, safeEqual, sha256 } from './crypto';
import type { ApiResponse, Deps, RequestCtx } from './types';

/** Admin password sign-in (ADR-020). Replaces the allow-listed email (ADR-014) and the open console (ADR-019). */
export const ADMIN_SESSION_MS = 12 * 3_600_000;
export const LOCK_WINDOW_MS = 15 * 60_000;
export const MAX_FAILS_PER_IP = 5;
export const MAX_FAILS_ALL = 20;
export const MIN_PASSWORD = 12;

const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });
const enabled = (deps: Deps) => typeof deps.adminPassword === 'string' && deps.adminPassword.length >= MIN_PASSWORD;

export interface Admin {
  actor: string; // audit name: "admin:<first 8 of the session hash>"
}

export async function adminLogin(deps: Deps, body: unknown, ctx: RequestCtx): Promise<ApiResponse> {
  if (!enabled(deps)) return bad('admin_disabled', 503);
  const now = deps.now();
  const since = now - LOCK_WINDOW_MS;
  const ipKey = `admin_fail:ip:${ctx.ip || 'unknown'}`;
  const [ipFails, allFails] = await Promise.all([deps.repo.countRate(ipKey, since), deps.repo.countRate('admin_fail:all', since)]);
  if (ipFails >= MAX_FAILS_PER_IP || allFails >= MAX_FAILS_ALL) return bad('locked', 429);
  const password = (body as { password?: unknown })?.password;
  const given = typeof password === 'string' && password.length <= 256 ? password : '';
  const ok = safeEqual(await sha256(given), await sha256(deps.adminPassword!));
  if (!ok) {
    await Promise.all([deps.repo.addRate(ipKey, now), deps.repo.addRate('admin_fail:all', now)]);
    return bad('wrong_password', 401);
  }
  const token = randomToken();
  const tokenHash = await sha256(token);
  await deps.repo.putAdminSession({ tokenHash, createdAt: now, expiresAt: now + ADMIN_SESSION_MS });
  await deps.repo.addAudit({ at: now, email: actorOf(tokenHash), action: 'admin.login', target: ctx.ip || 'unknown', detail: null });
  return { status: 200, body: { token, expiresAt: now + ADMIN_SESSION_MS } };
}

const actorOf = (tokenHash: string) => `admin:${tokenHash.slice(0, 8)}`;
const bearer = (auth: string | null) => {
  const t = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  return /^[0-9a-f]{64}$/.test(t) ? t : null;
};

export async function adminLogout(deps: Deps, auth: string | null): Promise<ApiResponse> {
  const t = bearer(auth);
  if (t) await deps.repo.deleteAdminSession(await sha256(t));
  return { status: 200, body: { ok: true } };
}

/** 401 = sign in again. 503 = no ADMIN_PASSWORD on the server. */
export async function requireAdmin(deps: Deps, auth: string | null): Promise<Admin | ApiResponse> {
  if (!enabled(deps)) return bad('admin_disabled', 503);
  const t = bearer(auth);
  if (!t) return bad('signed_out', 401);
  const hash = await sha256(t);
  const s = await deps.repo.findAdminSession(hash);
  if (!s || s.expiresAt <= deps.now()) return bad('signed_out', 401);
  return { actor: actorOf(hash) };
}
export const isResponse = (v: Admin | ApiResponse): v is ApiResponse => 'status' in v;

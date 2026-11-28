import { isResponse, requireAdmin } from './adminAuth';
import { accountFromBearer, checkCode, normalizeEmail, session } from './auth';
import { sha256 } from './crypto';
import { hashPassword, isValidPassword, temporaryPassword, verifyPassword } from './password';
import { DAY_MS, TRIAL_DAYS, type Account, type ApiResponse, type Deps, type MerchantProfile, type RequestCtx } from './types';

/** Merchant sign-up and password sign-in (ADR-023). */
export const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_LOGIN_FAILS_PER_EMAIL = 5;
export const MAX_LOGIN_FAILS_PER_IP = 20;
export const SIGNUP_WINDOW_MS = 60 * 60_000;
export const MAX_SIGNUPS_PER_IP = 10;

const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });
const CONTROL = /[\u0000-\u001f\u007f]/;

const text = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s.length >= min && s.length <= max && !CONTROL.test(s) ? s : null;
};

/** Indonesian mobile number → digits starting with 62 (0812… / 812… / +62 812…). */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 30) return null;
  let d = v.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(d)) return null;
  d = d.replace(/^\+/, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  return /^628\d{7,12}$/.test(d) ? d : null;
}

/** Field-level check of the sign-up form. Error codes name the field. */
export function checkProfile(b: Record<string, unknown>): { ok: true; value: MerchantProfile } | { ok: false; error: string } {
  const ownerName = text(b.ownerName, 2, 80);
  if (!ownerName) return { ok: false, error: 'invalid_owner_name' };
  const storeName = text(b.storeName, 2, 80);
  if (!storeName) return { ok: false, error: 'invalid_store_name' };
  const phone = normalizePhone(b.phone);
  if (!phone) return { ok: false, error: 'invalid_phone' };
  const city = text(b.city, 2, 60);
  if (!city) return { ok: false, error: 'invalid_city' };
  return { ok: true, value: { ownerName, storeName, phone, city } };
}

export const authOptions = (deps: Deps): ApiResponse => ({ status: 200, body: { emailReset: deps.emailEnabled, google: deps.google !== null, receiptEmail: Boolean(deps.mailer.sendReceipt) } });

export async function signUp(deps: Deps, body: unknown, ctx: RequestCtx): Promise<ApiResponse> {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(b.email);
  if (!email) return bad('invalid_email');
  if (!isValidPassword(b.password)) return bad('weak_password');
  const profile = checkProfile(b);
  if (!profile.ok) return bad(profile.error);
  const now = deps.now();
  const ipKey = `signup:ip:${ctx.ip || 'unknown'}`;
  if ((await deps.repo.countRate(ipKey, now - SIGNUP_WINDOW_MS)) >= MAX_SIGNUPS_PER_IP) return bad('too_many_signups', 429);
  if (await deps.repo.findAccountByEmail(email)) return bad('email_taken', 409);
  const a: Account = { id: crypto.randomUUID(), email, googleSub: null, createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY_MS, paidUntil: null, ...profile.value };
  if (!(await deps.repo.createAccount(a, await hashPassword(b.password)))) return bad('email_taken', 409);
  await deps.repo.addRate(ipKey, now);
  return session(deps, a);
}

/** Email + password. Unknown email and wrong password give the same answer. */
export async function passwordLogin(deps: Deps, body: unknown, ctx: RequestCtx): Promise<ApiResponse> {
  const b = (body ?? {}) as { email?: unknown; password?: unknown };
  const email = normalizeEmail(b.email);
  const password = typeof b.password === 'string' && b.password.length <= 256 ? b.password : '';
  if (!email || !password) return bad('wrong_credentials', 401);
  const now = deps.now();
  const since = now - LOGIN_WINDOW_MS;
  const emailKey = `login_fail:email:${await sha256(email)}`;
  const ipKey = `login_fail:ip:${ctx.ip || 'unknown'}`;
  const [emailFails, ipFails] = await Promise.all([deps.repo.countRate(emailKey, since), deps.repo.countRate(ipKey, since)]);
  if (emailFails >= MAX_LOGIN_FAILS_PER_EMAIL || ipFails >= MAX_LOGIN_FAILS_PER_IP) return bad('locked', 429);
  const a = await deps.repo.findAccountByEmail(email);
  const ok = await verifyPassword(password, a ? await deps.repo.getPasswordHash(a.id) : null);
  if (!a || !ok) {
    await Promise.all([deps.repo.addRate(emailKey, now), deps.repo.addRate(ipKey, now)]);
    return bad('wrong_credentials', 401);
  }
  return session(deps, a);
}

/** Forgot password: the code from /api/auth/code plus a new password. Signs out every other device. */
export async function resetPassword(deps: Deps, body: unknown): Promise<ApiResponse> {
  if (!deps.emailEnabled) return bad('email_disabled', 404);
  const b = (body ?? {}) as { email?: unknown; code?: unknown; password?: unknown };
  const email = normalizeEmail(b.email);
  if (!email) return bad('invalid_code');
  if (!isValidPassword(b.password)) return bad('weak_password');
  const failed = await checkCode(deps, email, typeof b.code === 'string' ? b.code.trim() : '');
  if (failed) return failed;
  const a = await deps.repo.findAccountByEmail(email);
  if (!a) return bad('code_expired'); // a code is only ever sent to an existing account
  await deps.repo.setPasswordHash(a.id, await hashPassword(b.password), deps.now());
  await deps.repo.deleteRefreshTokens(a.id);
  return session(deps, a);
}

/** Settings → change password. Bearer = refresh token. Other devices are signed out; this one gets a new session. */
export async function changePassword(deps: Deps, auth: string | null, body: unknown): Promise<ApiResponse> {
  const a = await accountFromBearer(deps, auth);
  if (!a) return bad('signed_out', 401);
  const b = (body ?? {}) as { current?: unknown; password?: unknown };
  if (!isValidPassword(b.password)) return bad('weak_password');
  const current = typeof b.current === 'string' && b.current.length <= 256 ? b.current : '';
  if (!(await verifyPassword(current, await deps.repo.getPasswordHash(a.id)))) return bad('wrong_password', 400);
  await deps.repo.setPasswordHash(a.id, await hashPassword(b.password), deps.now());
  await deps.repo.deleteRefreshTokens(a.id);
  return session(deps, a);
}

/** Admin → Merchant → "Buat kata sandi sementara". Shown once; the merchant's devices must sign in again. */
export async function adminTempPassword(deps: Deps, auth: string | null, accountId: string): Promise<ApiResponse> {
  const admin = await requireAdmin(deps, auth);
  if (isResponse(admin)) return admin;
  const a = await deps.repo.findAccountById(accountId);
  if (!a) return bad('not_found', 404);
  const password = temporaryPassword();
  const now = deps.now();
  await deps.repo.setPasswordHash(a.id, await hashPassword(password), now);
  await deps.repo.deleteRefreshTokens(a.id);
  await deps.repo.addAudit({ at: now, email: admin.actor, action: 'merchant.temp_password', target: a.id, detail: null });
  return { status: 200, body: { password } };
}

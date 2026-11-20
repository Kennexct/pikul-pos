import { randomCode, randomToken, safeEqual, sha256 } from './crypto';
import { DAY_MS, TRIAL_DAYS, type Account, type ApiResponse, type Deps, type RefreshToken } from './types';

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_RESEND_MS = 60_000;
export const CODE_MAX_ATTEMPTS = 5;
export const REFRESH_TTL_MS = 180 * DAY_MS;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
export const normalizeEmail = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
};
const bad = (error: string, status = 400): ApiResponse => ({ status, body: { error } });

/** Entitlement end: the later of the trial end and the paid-until date. */
export const entitledUntil = (a: Account) => Math.max(a.trialEndsAt, a.paidUntil ?? 0);
/** "paid" once a payment has pushed the end date past the trial; a paid extension always lands after the trial end. */
export const planOf = (a: Account): 'trial' | 'paid' => (a.paidUntil !== null && a.paidUntil >= a.trialEndsAt ? 'paid' : 'trial');

async function session(deps: Deps, a: Account): Promise<ApiResponse> {
  const now = deps.now();
  const refreshToken = randomToken();
  await deps.repo.putRefreshToken({ tokenHash: await sha256(refreshToken), accountId: a.id, expiresAt: now + REFRESH_TTL_MS });
  const until = entitledUntil(a);
  const plan = planOf(a);
  const pass = await deps.signer.sign({ sub: a.id, email: a.email, plan, until });
  return { status: 200, body: { pass, refreshToken, account: { email: a.email, plan, until, trialEndsAt: a.trialEndsAt, paidUntil: a.paidUntil } } };
}

async function findOrCreate(deps: Deps, email: string): Promise<Account> {
  const found = await deps.repo.findAccountByEmail(email);
  if (found) return found;
  const now = deps.now();
  const a: Account = { id: crypto.randomUUID(), email, googleSub: null, createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY_MS, paidUntil: null };
  await deps.repo.createAccount(a);
  return a;
}

export async function requestCode(deps: Deps, body: unknown): Promise<ApiResponse> {
  const email = normalizeEmail((body as { email?: unknown })?.email);
  if (!email) return bad('invalid_email');
  const now = deps.now();
  const prev = await deps.repo.getLoginCode(email);
  if (prev && now - prev.sentAt < CODE_RESEND_MS) return bad('too_soon', 429);
  const code = randomCode();
  await deps.repo.putLoginCode({ email, codeHash: await sha256(`${email}:${code}`), expiresAt: now + CODE_TTL_MS, attempts: 0, sentAt: now });
  await deps.mailer.sendLoginCode(email, code);
  return { status: 200, body: { ok: true } };
}

export async function verifyCode(deps: Deps, body: unknown): Promise<ApiResponse> {
  const b = body as { email?: unknown; code?: unknown };
  const email = normalizeEmail(b?.email);
  const code = typeof b?.code === 'string' ? b.code.trim() : '';
  if (!email || !/^\d{6}$/.test(code)) return bad('invalid_code');
  const row = await deps.repo.getLoginCode(email);
  if (!row || row.expiresAt < deps.now()) return bad('code_expired');
  if (row.attempts >= CODE_MAX_ATTEMPTS) {
    await deps.repo.deleteLoginCode(email);
    return bad('too_many_attempts', 429);
  }
  if (!safeEqual(row.codeHash, await sha256(`${email}:${code}`))) {
    await deps.repo.bumpLoginAttempts(email);
    return bad('invalid_code');
  }
  await deps.repo.deleteLoginCode(email);
  return session(deps, await findOrCreate(deps, email));
}

export async function googleSignIn(deps: Deps, body: unknown): Promise<ApiResponse> {
  if (!deps.google) return bad('google_disabled', 404);
  const token = (body as { idToken?: unknown })?.idToken;
  if (typeof token !== 'string' || token.length > 4096) return bad('invalid_token');
  const who = await deps.google.verify(token);
  if (!who) return bad('invalid_token', 401);
  const email = normalizeEmail(who.email);
  if (!email) return bad('invalid_token', 401);
  const a = await findOrCreate(deps, email);
  if (!a.googleSub) await deps.repo.setGoogleSub(a.id, who.sub);
  return session(deps, a);
}

/** Rotates the refresh token and returns a fresh pass with the current entitlement. */
export async function refresh(deps: Deps, body: unknown): Promise<ApiResponse> {
  const token = (body as { refreshToken?: unknown })?.refreshToken;
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return bad('signed_out', 401);
  const row = await deps.repo.takeRefreshToken(await sha256(token));
  if (!row || row.expiresAt < deps.now()) return bad('signed_out', 401);
  const a = await deps.repo.findAccountById(row.accountId);
  if (!a) return bad('signed_out', 401);
  return session(deps, a);
}

export async function signOut(deps: Deps, body: unknown): Promise<ApiResponse> {
  const token = (body as { refreshToken?: unknown })?.refreshToken;
  if (typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)) await deps.repo.takeRefreshToken(await sha256(token));
  return { status: 200, body: { ok: true } };
}

/** Resolves the account and token row behind a bearer refresh token without rotating it. */
export async function accountFromBearerRow(deps: Deps, header: string | null): Promise<{ account: Account; token: RefreshToken } | null> {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await deps.repo.findRefreshToken(await sha256(token));
  if (!row || row.expiresAt < deps.now()) return null;
  const account = await deps.repo.findAccountById(row.accountId);
  return account ? { account, token: row } : null;
}

/** Resolves the account behind a refresh token without rotating it (for billing calls). */
export async function accountFromBearer(deps: Deps, header: string | null): Promise<Account | null> {
  return (await accountFromBearerRow(deps, header))?.account ?? null;
}

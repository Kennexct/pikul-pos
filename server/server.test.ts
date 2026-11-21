import { exportJWK, generateKeyPair, jwtVerify } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { CODE_MAX_ATTEMPTS } from './auth';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { route } from './router';
import { signUpOrIn } from './testSignup';
import { DAY_MS, type Deps } from './types';

const T0 = Date.UTC(2026, 10, 19, 3);
let now = T0;
let mail: { email: string; code: string }[];
let repo: ReturnType<typeof memoryRepo>;
let deps: Deps;
let publicKey: CryptoKey;

beforeEach(async () => {
  now = T0;
  mail = [];
  repo = memoryRepo();
  const kp = await generateKeyPair('ES256', { extractable: true });
  publicKey = kp.publicKey as CryptoKey;
  const jwk = { ...(await exportJWK(kp.privateKey)), kid: 't1' };
  deps = {
    repo,
    mailer: { sendLoginCode: async (email, code) => void mail.push({ email, code }) },
    signer: await passSigner(jwk),
    google: { verify: async (t) => (t === 'good' ? { sub: 'g-1', email: 'Ani@Gmail.com' } : null) },
    now: () => now,
    appOrigin: 'https://pikul.test',
    adminPassword: null,
    emailEnabled: true,
  };
});

const call = (method: string, path: string, body?: unknown, auth?: string) =>
  route(deps, method, path, auth ? `Bearer ${auth}` : null, body === undefined ? '' : JSON.stringify(body));

async function signIn(email = 'budi@warung.id') {
  const res = await signUpOrIn(deps, email);
  return res.body as { pass: string; refreshToken: string; account: { plan: string; until: number } };
}

describe('sign up and sign in (ADR-023)', () => {
  it('sign-up creates the account with a 14-day trial and a pass the device can verify', async () => {
    const s = await signIn('  Budi@Warung.ID ');
    expect(s.account.plan).toBe('trial');
    expect(s.account.until).toBe(T0 + 14 * DAY_MS);
    const { payload } = await jwtVerify(s.pass, publicKey, { issuer: 'pikul' });
    expect(payload).toMatchObject({ email: 'budi@warung.id', plan: 'trial', until: T0 + 14 * DAY_MS });
  });

  it('keeps the same account and trial on a second sign-in', async () => {
    await signIn();
    now += 5 * DAY_MS;
    expect((await signIn()).account.until).toBe(T0 + 14 * DAY_MS);
    expect(repo.accounts.size).toBe(1);
  });

  it('email codes: only for existing accounts, resend limit, wrong and expired codes, lock after 5 wrong tries', async () => {
    expect((await call('POST', '/api/auth/code', { email: 'nope' })).status).toBe(400);
    expect((await call('POST', '/api/auth/code', { email: 'ghost@b.co' })).status).toBe(200);
    expect(mail).toHaveLength(0);
    await signIn('a@b.co');
    await call('POST', '/api/auth/code', { email: 'a@b.co' });
    expect((await call('POST', '/api/auth/code', { email: 'a@b.co' })).status).toBe(429);
    const code = mail[0].code;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < CODE_MAX_ATTEMPTS; i++) expect((await call('POST', '/api/auth/verify', { email: 'a@b.co', code: wrong })).status).toBe(400);
    expect((await call('POST', '/api/auth/verify', { email: 'a@b.co', code })).status).toBe(429);
    now += 61_000;
    await call('POST', '/api/auth/code', { email: 'a@b.co' });
    now += 11 * 60_000;
    expect((await call('POST', '/api/auth/verify', { email: 'a@b.co', code: mail[1].code })).body).toEqual({ error: 'code_expired' });
  });

  it('code is single use', async () => {
    await signIn('a@b.co');
    await call('POST', '/api/auth/code', { email: 'a@b.co' });
    const code = mail[0].code;
    expect((await call('POST', '/api/auth/verify', { email: 'a@b.co', code })).status).toBe(200);
    expect((await call('POST', '/api/auth/verify', { email: 'a@b.co', code })).status).toBe(400);
  });

  it('Google signs in an existing account only', async () => {
    expect((await call('POST', '/api/auth/google', { idToken: 'good' })).body).toEqual({ error: 'no_account' });
    await signIn('ani@gmail.com');
    expect((await call('POST', '/api/auth/google', { idToken: 'good' })).status).toBe(200);
    expect(repo.accounts.size).toBe(1);
    expect((await call('POST', '/api/auth/google', { idToken: 'bad' })).status).toBe(401);
  });
});

describe('refresh tokens', () => {
  it('rotate: the old token stops working; sign-out revokes', async () => {
    const s = await signIn();
    const r1 = await call('POST', '/api/auth/refresh', { refreshToken: s.refreshToken });
    expect(r1.status).toBe(200);
    expect((await call('POST', '/api/auth/refresh', { refreshToken: s.refreshToken })).status).toBe(401);
    const t2 = (r1.body as { refreshToken: string }).refreshToken;
    await call('POST', '/api/auth/signout', { refreshToken: t2 });
    expect((await call('POST', '/api/auth/refresh', { refreshToken: t2 })).status).toBe(401);
  });
});

describe('subscription overview', () => {
  it('shows the entitlement and the plans; needs a session', async () => {
    expect((await call('GET', '/api/billing')).status).toBe(401);
    const s = await signIn();
    const ov = (await call('GET', '/api/billing', undefined, s.refreshToken)).body as { account: { plan: string; until: number }; plans: { id: string; amount: number }[] };
    expect(ov.account).toMatchObject({ plan: 'trial', until: T0 + 14 * DAY_MS });
    expect(ov.plans.map((p) => [p.id, p.amount])).toEqual([['monthly', 49_000], ['yearly', 490_000]]);
  });

  it('has no payment endpoints (Midtrans removed, ADR-015)', async () => {
    const s = await signIn();
    expect((await call('POST', '/api/billing/checkout', { plan: 'monthly' }, s.refreshToken)).status).toBe(404);
    expect((await call('POST', '/api/billing/midtrans', {})).status).toBe(404);
    expect((await call('GET', '/api/nope')).status).toBe(404);
    expect((await route(deps, 'POST', '/api/auth/code', null, '{bad')).status).toBe(400);
  });
});

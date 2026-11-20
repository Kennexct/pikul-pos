import { exportJWK, generateKeyPair, jwtVerify } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { CODE_MAX_ATTEMPTS } from './auth';
import { sha512 } from './crypto';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { route } from './router';
import { DAY_MS, type Deps, type MidtransStatus } from './types';

const T0 = Date.UTC(2026, 10, 19, 3);
let now = T0;
let mail: { email: string; code: string }[];
let repo: ReturnType<typeof memoryRepo>;
let deps: Deps;
let publicKey: CryptoKey;
let midStatus: MidtransStatus | null;
const SERVER_KEY = 'SB-Mid-server-test';

beforeEach(async () => {
  now = T0;
  mail = [];
  midStatus = null;
  repo = memoryRepo();
  const kp = await generateKeyPair('ES256', { extractable: true });
  publicKey = kp.publicKey as CryptoKey;
  const jwk = { ...(await exportJWK(kp.privateKey)), kid: 't1' };
  deps = {
    repo,
    mailer: { sendLoginCode: async (email, code) => void mail.push({ email, code }) },
    midtrans: {
      serverKey: SERVER_KEY,
      createSnap: async ({ orderId }) => ({ token: 'tok', redirectUrl: `https://snap.test/${orderId}` }),
      getStatus: async () => midStatus,
    },
    signer: await passSigner(jwk),
    google: { verify: async (t) => (t === 'good' ? { sub: 'g-1', email: 'Ani@Gmail.com' } : null) },
    now: () => now,
    appOrigin: 'https://kasirku.test',
    adminEmails: [],
  };
});

const call = (method: string, path: string, body?: unknown, auth?: string) =>
  route(deps, method, path, auth ? `Bearer ${auth}` : null, body === undefined ? '' : JSON.stringify(body));

async function signIn(email = 'budi@warung.id') {
  await call('POST', '/api/auth/code', { email });
  const code = mail.at(-1)!.code;
  const res = await call('POST', '/api/auth/verify', { email, code });
  return res.body as { pass: string; refreshToken: string; account: { plan: string; until: number } };
}

async function notify(orderId: string, amount: number, status = 'settlement', extra: Record<string, string> = {}) {
  const gross = `${amount}.00`;
  const body = { order_id: orderId, status_code: '200', gross_amount: gross, transaction_status: status, payment_type: 'qris', signature_key: await sha512(orderId + '200' + gross + SERVER_KEY), ...extra };
  return call('POST', '/api/billing/midtrans', body);
}

describe('sign in with email code', () => {
  it('creates the account with a 14-day trial and a pass the device can verify', async () => {
    const s = await signIn('  Budi@Warung.ID ');
    expect(mail[0].email).toBe('budi@warung.id');
    expect(s.account.plan).toBe('trial');
    expect(s.account.until).toBe(T0 + 14 * DAY_MS);
    const { payload } = await jwtVerify(s.pass, publicKey, { issuer: 'kasirku' });
    expect(payload).toMatchObject({ email: 'budi@warung.id', plan: 'trial', until: T0 + 14 * DAY_MS });
  });

  it('keeps the same account and trial on a second sign-in', async () => {
    await signIn();
    now += 5 * DAY_MS;
    expect((await signIn()).account.until).toBe(T0 + 14 * DAY_MS);
    expect(repo.accounts.size).toBe(1);
  });

  it('rejects bad emails, resend within 60 s, wrong and expired codes, and locks after 5 wrong tries', async () => {
    expect((await call('POST', '/api/auth/code', { email: 'nope' })).status).toBe(400);
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
    await call('POST', '/api/auth/code', { email: 'a@b.co' });
    const code = mail[0].code;
    expect((await call('POST', '/api/auth/verify', { email: 'a@b.co', code })).status).toBe(200);
    expect((await call('POST', '/api/auth/verify', { email: 'a@b.co', code })).status).toBe(400);
  });

  it('Google sign-in links to the same email account', async () => {
    await signIn('ani@gmail.com');
    const res = await call('POST', '/api/auth/google', { idToken: 'good' });
    expect(res.status).toBe(200);
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

describe('billing', () => {
  it('checkout → notification extends from the trial end; repeated notifications apply once', async () => {
    const s = await signIn();
    const co = await call('POST', '/api/billing/checkout', { plan: 'monthly' }, s.refreshToken);
    expect(co.status).toBe(200);
    const { orderId, redirectUrl } = co.body as { orderId: string; redirectUrl: string };
    expect(redirectUrl).toContain(orderId);
    now += 2 * DAY_MS;
    expect((await notify(orderId, 49_000)).status).toBe(200);
    expect((await notify(orderId, 49_000)).status).toBe(200);
    const a = [...repo.accounts.values()][0];
    expect(a.paidUntil).toBe(T0 + 14 * DAY_MS + 30 * DAY_MS);
    const ov = (await call('GET', '/api/billing', undefined, s.refreshToken)).body as { account: { plan: string; until: number }; payments: { status: string }[] };
    expect(ov.account.plan).toBe('paid');
    expect(ov.payments[0].status).toBe('paid');
    // the refreshed pass carries the new end date
    const r = (await call('POST', '/api/auth/refresh', { refreshToken: s.refreshToken })).body as { account: { until: number } };
    expect(r.account.until).toBe(a.paidUntil);
  });

  it('a payment after expiry extends from the payment date', async () => {
    const s = await signIn();
    now = T0 + 40 * DAY_MS;
    const { orderId } = (await call('POST', '/api/billing/checkout', { plan: 'yearly' }, s.refreshToken)).body as { orderId: string };
    await notify(orderId, 490_000);
    expect([...repo.accounts.values()][0].paidUntil).toBe(now + 365 * DAY_MS);
  });

  it('rejects forged signatures and wrong amounts; ignores pending and records failures', async () => {
    const s = await signIn();
    const { orderId } = (await call('POST', '/api/billing/checkout', { plan: 'monthly' }, s.refreshToken)).body as { orderId: string };
    const forged = await call('POST', '/api/billing/midtrans', { order_id: orderId, status_code: '200', gross_amount: '49000.00', transaction_status: 'settlement', signature_key: 'ab'.repeat(64) });
    expect(forged.status).toBe(403);
    expect((await notify(orderId, 1)).status).toBe(400);
    await notify(orderId, 49_000, 'pending');
    expect(repo.payments.get(orderId)!.status).toBe('pending');
    await notify(orderId, 49_000, 'capture', { fraud_status: 'challenge' });
    expect(repo.payments.get(orderId)!.status).toBe('pending');
    await notify(orderId, 49_000, 'deny');
    expect(repo.payments.get(orderId)!.status).toBe('failed');
    expect([...repo.accounts.values()][0].paidUntil).toBeNull();
  });

  it('status check asks Midtrans when the notification is late, and hides other accounts\' orders', async () => {
    const s = await signIn();
    const other = await signIn('lain@toko.id');
    const { orderId } = (await call('POST', '/api/billing/checkout', { plan: 'monthly' }, s.refreshToken)).body as { orderId: string };
    expect((await call('GET', `/api/billing/status/${orderId}`, undefined, other.refreshToken)).status).toBe(404);
    midStatus = { transactionStatus: 'settlement', fraudStatus: 'accept', grossAmount: 49_000, paymentType: 'gopay' };
    const st = await call('GET', `/api/billing/status/${orderId}`, undefined, s.refreshToken);
    expect(st.body).toMatchObject({ status: 'paid', method: 'gopay' });
  });

  it('billing needs a valid session and a known plan', async () => {
    expect((await call('POST', '/api/billing/checkout', { plan: 'monthly' })).status).toBe(401);
    const s = await signIn();
    expect((await call('POST', '/api/billing/checkout', { plan: 'lifetime' }, s.refreshToken)).status).toBe(400);
    expect((await call('GET', '/api/nope')).status).toBe(404);
    expect((await route(deps, 'POST', '/api/auth/code', null, '{bad')).status).toBe(400);
  });
});

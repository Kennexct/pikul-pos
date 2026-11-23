import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { isDate, jakartaDate, paidUntilAfterCancel } from './ledger';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { route } from './router';
import { signUpOrIn } from './testSignup';
import { DAY_MS, type Deps } from './types';

const T0 = Date.UTC(2026, 10, 21, 3); // 21 Nov 2026, 10:00 WIB
const PASSWORD = 'pikul-rahasia-123';
let now = T0;
let mail: { email: string; code: string }[];
let repo: ReturnType<typeof memoryRepo>;
let deps: Deps;
let admin = '';

let loginAt = 0;
const raw = (method: string, path: string, body: unknown, auth: string, query: string) =>
  route(deps, method, path, auth ? `Bearer ${auth}` : null, body === undefined ? '' : JSON.stringify(body), { ip: '10.0.0.1', query: new URLSearchParams(query) });
/** Signs the admin in again after the test moves the clock past the 12-hour session. */
async function call(method: string, path: string, body?: unknown, auth: string | null = null, query = '') {
  if (auth === null && now - loginAt > 11 * 3_600_000) {
    admin = ((await raw('POST', '/api/admin/login', { password: PASSWORD }, '', '')).body as { token: string }).token;
    loginAt = now;
  }
  return raw(method, path, body, auth ?? admin, query);
}

async function merchant(email: string) {
  const res = await signUpOrIn(deps, email);
  const refreshToken = (res.body as { refreshToken: string }).refreshToken;
  const id = [...repo.accounts.values()].find((a) => a.email === email)!.id;
  return { id, refreshToken };
}
const pay = (over: Record<string, unknown> = {}) => ({ planId: 'monthly', amount: 49_000, days: 30, method: 'transfer', reference: 'BCA 123', paidOn: jakartaDate(now), note: '', ...over });
type View = { id: string; email: string; status: string; until: number; planName: string | null; totalPaid: number };

beforeEach(async () => {
  now = T0;
  mail = [];
  repo = memoryRepo();
  const kp = await generateKeyPair('ES256', { extractable: true });
  deps = {
    repo,
    mailer: { sendLoginCode: async (email, code) => void mail.push({ email, code }) },
    signer: await passSigner({ ...(await exportJWK(kp.privateKey)), kid: 't1' }),
    google: null,
    now: () => now,
    appOrigin: 'https://pikul.test',
    adminPassword: PASSWORD,
    emailEnabled: true,
  };
  admin = '';
  loginAt = -Infinity;
});

describe('record payment', () => {
  it('extends from the trial end, so no trial day is lost, and the app sees it on refresh', async () => {
    const m = await merchant('budi@warung.id');
    const trialEnd = T0 + 14 * DAY_MS;
    const res = await call('POST', `/api/admin/merchants/${m.id}/payments`, pay());
    expect(res.status).toBe(200);
    expect((res.body as { payment: { startsAt: number; endsAt: number } }).payment).toMatchObject({ startsAt: trialEnd, endsAt: trialEnd + 30 * DAY_MS });
    expect(repo.accounts.get(m.id)!.paidUntil).toBe(trialEnd + 30 * DAY_MS);
    expect(repo.audit.at(-1)).toMatchObject({ action: 'payment.record' });
    const refreshed = (await call('POST', '/api/auth/refresh', { refreshToken: m.refreshToken }, '')).body as { account: { plan: string; until: number } };
    expect(refreshed.account).toMatchObject({ plan: 'paid', until: trialEnd + 30 * DAY_MS });
  });

  it('a second payment stacks on the first; after expiry it starts from today', async () => {
    const m = await merchant('sari@kopi.id');
    await call('POST', `/api/admin/merchants/${m.id}/payments`, pay());
    await call('POST', `/api/admin/merchants/${m.id}/payments`, pay({ planId: 'yearly', amount: 490_000, days: 365 }));
    expect(repo.accounts.get(m.id)!.paidUntil).toBe(T0 + (14 + 30 + 365) * DAY_MS);
    now = T0 + 500 * DAY_MS;
    await call('POST', `/api/admin/merchants/${m.id}/payments`, pay({ paidOn: jakartaDate(now) }));
    expect(repo.accounts.get(m.id)!.paidUntil).toBe(now + 30 * DAY_MS);
  });

  it('refuses bad input', async () => {
    const m = await merchant('budi@warung.id');
    for (const bad of [{ amount: -1 }, { amount: 1.5 }, { days: 0 }, { method: 'bitcoin' }, { planId: 'nope' }, { paidOn: '2026-13-01' }, { paidOn: jakartaDate(now + DAY_MS) }, { paidOn: '2026-01-01' }, { reference: 'x'.repeat(81) }])
      expect((await call('POST', `/api/admin/merchants/${m.id}/payments`, pay(bad))).status).toBe(400);
    expect((await call('POST', `/api/admin/merchants/${crypto.randomUUID()}/payments`, pay())).status).toBe(404);
    expect((await call('POST', `/api/admin/merchants/${m.id}/payments`, pay(), '')).status).toBe(401);
  });

  it('a race on the same account is refused, not double-counted', async () => {
    const m = await merchant('budi@warung.id');
    const orig = repo.recordPayment;
    repo.recordPayment = async (p, expected) => {
      repo.accounts.get(m.id)!.paidUntil = 1; // another tab wrote first
      return orig(p, expected);
    };
    expect((await call('POST', `/api/admin/merchants/${m.id}/payments`, pay())).body).toEqual({ error: 'conflict' });
  });
});

describe('cancel payment and grants', () => {
  it('cancelling takes the payment\'s days off; with none left the account is back on its trial', async () => {
    const m = await merchant('budi@warung.id');
    const p1 = ((await call('POST', `/api/admin/merchants/${m.id}/payments`, pay())).body as { payment: { id: string } }).payment.id;
    now += 1;
    const p2 = ((await call('POST', `/api/admin/merchants/${m.id}/payments`, pay({ days: 60 }))).body as { payment: { id: string } }).payment.id;
    expect((await call('POST', `/api/admin/payments/${p2}/cancel`, { reason: '' })).status).toBe(400);
    expect((await call('POST', `/api/admin/payments/${p1}/cancel`, { reason: 'salah akun' })).status).toBe(200);
    expect(repo.accounts.get(m.id)!.paidUntil).toBe(T0 + (14 + 60) * DAY_MS);
    expect((await call('POST', `/api/admin/payments/${p1}/cancel`, { reason: 'lagi' })).status).toBe(409);
    await call('POST', `/api/admin/payments/${p2}/cancel`, { reason: 'dobel' });
    expect(repo.accounts.get(m.id)!.paidUntil).toBeNull(); // back on the trial (ends T0 + 14 days)
    const detail = (await call('GET', `/api/admin/merchants/${m.id}`)).body as { payments: { cancelledAt: number | null }[]; merchant: View };
    expect(detail.payments.every((p) => p.cancelledAt !== null)).toBe(true); // kept, marked cancelled
    expect(detail.merchant.totalPaid).toBe(0);
  });

  it('pure rule: days come off the end, never before the trial end', () => {
    const base = { accountId: 'a', planId: null, amount: 1, method: 'cash' as const, reference: '', paidOn: '2026-11-21', note: '', startsAt: 0, endsAt: 0, recordedBy: 'x', cancelledAt: null, cancelReason: null, prevPaidUntil: null };
    const p1 = { ...base, id: '1', days: 30, recordedAt: 1 };
    const p2 = { ...base, id: '2', days: 365, recordedAt: 2 };
    const acc = { id: 'a', email: 'e', googleSub: null, createdAt: 0, trialEndsAt: 100, paidUntil: 395 * DAY_MS + 100 };
    expect(paidUntilAfterCancel(p1, acc, [p1])).toBeNull();
    expect(paidUntilAfterCancel(p2, acc, [p1, p2])).toBe(30 * DAY_MS + 100);
    expect(paidUntilAfterCancel(p1, { ...acc, paidUntil: 10 * DAY_MS }, [p1, p2])).toBe(100);
  });

  it('gives free trial days with a reason', async () => {
    const m = await merchant('budi@warung.id');
    expect((await call('POST', `/api/admin/merchants/${m.id}/grants`, { days: 7 })).body).toEqual({ error: 'invalid_reason' });
    expect((await call('POST', `/api/admin/merchants/${m.id}/grants`, { days: 61, reason: 'x' })).status).toBe(400);
    expect((await call('POST', `/api/admin/merchants/${m.id}/grants`, { days: 7, reason: 'Pameran UMKM' })).status).toBe(200);
    expect(repo.accounts.get(m.id)!.trialEndsAt).toBe(T0 + 21 * DAY_MS);
    expect(((await call('GET', `/api/admin/merchants/${m.id}`)).body as { grants: unknown[] }).grants).toHaveLength(1);
  });
});

describe('merchant list, payments and overview', () => {
  it('filters by status and plan, searches by email, and counts plans', async () => {
    const a = await merchant('budi@warung.id');
    await merchant('sari@kopi.id');
    now += 20 * DAY_MS;
    await merchant('dika@gorengan.id');
    await call('POST', `/api/admin/merchants/${a.id}/payments`, pay({ planId: 'yearly', days: 365, paidOn: jakartaDate(now) }));
    const list = async (query: string) => (await call('GET', '/api/admin/merchants', undefined, null, query)).body as { total: number; rows: View[]; plans: { key: string; count: number }[] };
    expect((await list('')).rows.map((r) => r.email)).toEqual(['dika@gorengan.id', 'budi@warung.id', 'sari@kopi.id']);
    expect((await list('filter=paid')).rows.map((r) => r.email)).toEqual(['budi@warung.id']);
    expect((await list('filter=paid')).rows[0].planName).toBe('Tahunan');
    expect((await list('filter=expired')).rows.map((r) => r.email)).toEqual(['sari@kopi.id']);
    expect((await list('filter=trial')).rows.map((r) => r.email)).toEqual(['dika@gorengan.id']);
    expect((await list('q=KOPI')).total).toBe(1);
    expect((await list('plan=yearly')).total).toBe(1);
    expect(Object.fromEntries((await list('')).plans.map((p) => [p.key, p.count]))).toEqual({ trial: 1, monthly: 0, yearly: 1, expired: 1 });
  });

  it('shows the shop profile the merchant last saved in the app, not the sign-up details', async () => {
    const m = await merchant('budi@warung.id');
    const view = async () => ((await call('GET', `/api/admin/merchants/${m.id}`)).body as { merchant: View & { storeName: string; phone: string; address: string } }).merchant;
    const signUp = await view();
    expect(signUp.address).toBe('');

    const store = '0190f0aa-0000-7000-8000-000000000001';
    const hello = { storeId: store, deviceId: '0190f0aa-0000-7000-8000-0000000000d1', receiptCode: 'AB', appVersion: '0.19.4' };
    const bearer = (path: string, body: unknown) => raw('POST', path, body, m.refreshToken, '');
    expect((await bearer('/api/sync/claim', hello)).status).toBe(200);
    const row = (name: string, phone: string, at: number) => ({
      table: 'stores',
      id: store,
      data: { id: store, name, phone, address: 'Jl. Melati 5, Bekasi', updatedAt: new Date(at).toISOString() },
    });
    expect((await bearer('/api/sync/push', { ...hello, records: [row('Warung Budi Jaya', '0813-1111-2222', now)] })).status).toBe(200);
    expect(await view()).toMatchObject({ storeName: 'Warung Budi Jaya', phone: '6281311112222', address: 'Jl. Melati 5, Bekasi' });

    // A landline cannot open WhatsApp: the sign-up number stays; the newer name still wins.
    now += 60_000;
    await bearer('/api/sync/push', { ...hello, records: [row('Warung Budi Baru', '021 555 123', now)] });
    expect(await view()).toMatchObject({ storeName: 'Warung Budi Baru', phone: signUp.phone });
    expect(((await call('GET', '/api/admin/merchants', undefined, null, 'q=melati')).body as { total: number }).total).toBe(1);
  });

  it('lists a month of payments with a total and a CSV download', async () => {
    const m = await merchant('budi@warung.id');
    await call('POST', `/api/admin/merchants/${m.id}/payments`, pay({ reference: '=HYPERLINK("x")' }));
    const res = (await call('GET', '/api/admin/payments', undefined, null, 'month=2026-11')).body as { total: number; rows: { email: string }[] };
    expect(res.total).toBe(49_000);
    expect(res.rows[0].email).toBe('budi@warung.id');
    expect(((await call('GET', '/api/admin/payments', undefined, null, 'month=2026-10')).body as { total: number }).total).toBe(0);
    const csv = await call('GET', '/api/admin/payments', undefined, null, 'month=2026-11&format=csv');
    expect(csv.text?.filename).toBe('pembayaran-pikul-2026-11.csv');
    expect(csv.text?.content).toContain("'=HYPERLINK");
    expect((await call('GET', '/api/admin/payments', undefined, null, 'month=bad')).status).toBe(400);
  });

  it('overview counts merchants, conversion, revenue and who to contact', async () => {
    const a = await merchant('budi@warung.id');
    await merchant('sari@kopi.id');
    now += 12 * DAY_MS; // both trials end in 2 days
    await call('POST', `/api/admin/merchants/${a.id}/payments`, pay({ paidOn: jakartaDate(now) }));
    const o = (await call('GET', '/api/admin/overview')).body as {
      counts: Record<string, number>;
      revenue: { thisMonth: number };
      followUps: { email: string; reason: string }[];
      conversion: { eligible: number };
    };
    expect(o.counts).toMatchObject({ total: 2, paid: 1, trial: 1, expired: 0, signups30: 2 });
    expect(o.revenue.thisMonth).toBe(49_000);
    expect(o.followUps.map((f) => [f.email, f.reason])).toEqual([['sari@kopi.id', 'trial_ending']]);
    expect(o.conversion.eligible).toBe(0);
  });

  it('records last active on sign-in and refresh', async () => {
    const m = await merchant('budi@warung.id');
    now += 3 * DAY_MS;
    await call('POST', '/api/auth/refresh', { refreshToken: m.refreshToken }, '');
    const v = ((await call('GET', `/api/admin/merchants/${m.id}`)).body as { merchant: { lastSeenAt: number } }).merchant;
    expect(v.lastSeenAt).toBe(now);
  });
});

describe('dates', () => {
  it('validates calendar dates in Jakarta time', () => {
    expect(isDate('2026-02-29')).toBe(false);
    expect(isDate('2028-02-29')).toBe(true);
    expect(jakartaDate(Date.UTC(2026, 10, 20, 17, 30))).toBe('2026-11-21');
  });
});

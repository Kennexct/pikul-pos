import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPay } from './adminTypes';
import { bucketOf, weekdays } from './analytics';
import { MAX_DAILY_POSTS_PER_HOUR } from './daily';
import { jakartaDate } from './ledger';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { route } from './router';
import { signUpOrIn } from './testSignup';
import { DEFAULT_CONTENT } from './siteContent';
import { DAY_MS, type Deps } from './types';

const T0 = Date.UTC(2026, 10, 21, 3);
const PASSWORD = 'pikul-rahasia-123';
let now = T0;
let mail: { email: string; code: string }[];
let repo: ReturnType<typeof memoryRepo>;
let deps: Deps;
let admin = '';

const raw = (method: string, path: string, body?: unknown, auth = '', query = '') =>
  route(deps, method, path, auth ? `Bearer ${auth}` : null, body === undefined ? '' : JSON.stringify(body), { ip: '10.0.0.1', query: new URLSearchParams(query) });
const asAdmin = (method: string, path: string, body?: unknown, query = '') => raw(method, path, body, admin, query);

async function merchant(email: string) {
  const res = await signUpOrIn(deps, email);
  return { id: [...repo.accounts.values()].find((a) => a.email === email)!.id, token: (res.body as { refreshToken: string }).refreshToken };
}

const hours = () => Array.from({ length: 24 }, () => ({ transactions: 0, gross: 0 }));
function day(date: string, tx: number, net: number, over: Record<string, unknown> = {}) {
  const pay = emptyPay();
  pay.cash = { transactions: tx - 1, gross: net - 10_000, refunds: 0 };
  pay.qris = { transactions: 1, gross: 10_000, refunds: 0 };
  const h = hours();
  h[12] = { transactions: tx, gross: net };
  return { businessDate: date, transactions: tx, gross: net, discounts: 0, refunds: 0, net, voidCount: 0, voidAmount: 0, itemsSold: tx * 2, pay, modes: [{ name: 'Dine In', transactions: tx, gross: net, refunds: 0 }], hours: h, computedAt: now, ...over };
}

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
  admin = ((await raw('POST', '/api/admin/login', { password: PASSWORD })).body as { token: string }).token;
});

describe('daily totals from the app', () => {
  it('stores totals for the sender only; a newer computation replaces an older one', async () => {
    const m = await merchant('budi@warung.id');
    expect((await raw('POST', '/api/merchant/daily', { appVersion: '0.17.0', rows: [day('2026-11-20', 10, 150_000)] })).status).toBe(401);
    expect((await raw('POST', '/api/merchant/daily', { appVersion: '0.17.0', rows: [day('2026-11-20', 10, 150_000)] }, m.token)).body).toEqual({ ok: true, saved: 1 });
    await raw('POST', '/api/merchant/daily', { appVersion: '0.17.0', rows: [day('2026-11-20', 12, 180_000, { computedAt: now + 1 })] }, m.token);
    await raw('POST', '/api/merchant/daily', { appVersion: '0.17.0', rows: [day('2026-11-20', 1, 1_000, { computedAt: now - 5 })] }, m.token); // stale device
    const s = (await asAdmin('GET', `/api/admin/merchants/${m.id}/summary`, undefined, 'from=2026-11-14&to=2026-11-20')).body as {
      totals: { transactions: number; net: number; averageTicket: number };
      byPay: { type: string; transactions: number }[];
      byMode: { name: string }[];
      days: unknown[];
      hours: { transactions: number }[];
    };
    expect(s.totals).toMatchObject({ transactions: 12, net: 180_000, averageTicket: 15_000 });
    expect(s.byPay.find((p) => p.type === 'qris')?.transactions).toBe(1);
    expect(s.byMode.map((x) => x.name)).toEqual(['Dine In']);
    expect(s.days).toHaveLength(7);
    expect(s.hours[12].transactions).toBe(12);
  });

  it('refuses bad rows: dates, negatives, missing hours, duplicates, too many', async () => {
    const m = await merchant('budi@warung.id');
    const post = (rows: unknown[], v = '0.17.0') => raw('POST', '/api/merchant/daily', { appVersion: v, rows }, m.token);
    for (const bad of [
      [day('2026-13-01', 1, 1)],
      [day(jakartaDate(now + 3 * DAY_MS), 1, 1)],
      [day('2026-11-20', -1, 1)],
      [day('2026-11-20', 1, 1, { hours: [] })],
      [day('2026-11-20', 1, 1, { modes: [{ name: '', transactions: 1, gross: 1, refunds: 0 }] })],
      [day('2026-11-20', 1, 1), day('2026-11-20', 2, 2)],
      Array.from({ length: 36 }, (_, i) => day(jakartaDate(now - i * DAY_MS), 1, 1)),
    ])
      expect((await post(bad)).status).toBe(400);
    expect((await post([day('2026-11-20', 1, 1)], '<script>')).status).toBe(400);
  });

  it('rate-limits a device that posts too often', async () => {
    const m = await merchant('budi@warung.id');
    for (let i = 0; i < MAX_DAILY_POSTS_PER_HOUR; i++) await repo.addRate(`daily:${m.id}`, now);
    expect((await raw('POST', '/api/merchant/daily', { appVersion: '0.17.0', rows: [day('2026-11-20', 1, 1)] }, m.token)).status).toBe(429);
  });
});

describe('executive report', () => {
  it('sums all merchants, ranks the top, groups by activity, and counts Pikul revenue', async () => {
    const a = await merchant('budi@warung.id');
    const b = await merchant('sari@kopi.id');
    await merchant('dika@gorengan.id');
    await raw('POST', '/api/merchant/daily', { appVersion: '0.17.0', rows: [day('2026-11-20', 60 * 7, 3_000_000), day('2026-11-19', 1, 15_000)] }, a.token);
    await raw('POST', '/api/merchant/daily', { appVersion: '0.17.0', rows: [day('2026-11-20', 20, 200_000)] }, b.token);
    await asAdmin('POST', `/api/admin/merchants/${a.id}/payments`, { planId: 'monthly', amount: 49_000, days: 30, method: 'qris', reference: '', paidOn: '2026-11-21', note: '' });
    const r = (await asAdmin('GET', '/api/admin/report', undefined, 'from=2026-11-15&to=2026-11-21')).body as {
      business: { signups: number; revenue: number; activeMerchants: number; payingNow: number };
      merchants: { totals: { transactions: number; net: number }; top: { email: string; share: number }[]; buckets: { key: string; count: number }[]; days: unknown[]; byMode: unknown[] };
    };
    expect(r.business).toMatchObject({ signups: 3, revenue: 49_000, activeMerchants: 2, payingNow: 1 });
    expect(r.merchants.totals).toMatchObject({ transactions: 441, net: 3_215_000 });
    expect(r.merchants.top.map((t) => t.email)).toEqual(['budi@warung.id', 'sari@kopi.id']);
    expect(r.merchants.top[0].share).toBeCloseTo(3_015_000 / 3_215_000);
    expect(Object.fromEntries(r.merchants.buckets.map((x) => [x.key, x.count]))).toEqual({ '0': 1, '1-10': 1, '11-50': 0, '51+': 1 });
    expect(r.merchants.days).toHaveLength(7);
    const csv = await asAdmin('GET', '/api/admin/report', undefined, 'from=2026-11-15&to=2026-11-21&format=csv');
    expect(csv.text?.content.split('\r\n')[1]).toContain('budi@warung.id');
    expect((await asAdmin('GET', '/api/admin/report', undefined, 'from=2025-01-01&to=2026-11-21')).status).toBe(400);
    expect((await raw('GET', '/api/admin/report')).status).toBe(401);
  });

  it('pure helpers: weekday and activity bucket', () => {
    expect(weekdays([{ date: '2026-11-21', transactions: 3, net: 9 }])[6]).toMatchObject({ transactions: 3, days: 1 }); // Saturday
    expect([0, 0.2, 10, 10.5, 50, 51].map(bucketOf)).toEqual([0, 1, 1, 2, 2, 3]);
  });
});

describe('landing content and register pop-up', () => {
  it('starts from the built-in text, saves edits, hides hidden items publicly, and resets', async () => {
    const got = (await asAdmin('GET', '/api/admin/content')).body as { isDefault: boolean; content: { faqs: unknown[] } };
    expect(got.isDefault).toBe(true);
    expect(got.content.faqs.length).toBe(DEFAULT_CONTENT.faqs.length);
    expect(((await raw('GET', '/api/public/landing')).body as { content: unknown }).content).toBeNull();
    const edit = { ...DEFAULT_CONTENT, heroTitle: 'Kasir offline untuk warung', faqs: [{ q: 'Ada biaya?', a: 'Tidak ada biaya per transaksi.\nCoba 14 hari.', hidden: false }, { q: 'Rahasia', a: 'x', hidden: true }] };
    const saved = await asAdmin('POST', '/api/admin/content', edit);
    expect(saved.purgePublic).toBe(true);
    const pub = ((await raw('GET', '/api/public/landing')).body as { content: { heroTitle: string; faqs: { q: string }[] } }).content;
    expect(pub.heroTitle).toBe('Kasir offline untuk warung');
    expect(pub.faqs.map((f) => f.q)).toEqual(['Ada biaya?']);
    for (const bad of [{ heroTitle: '' }, { heroTitle: 'a\nb' }, { faqs: [{ q: 'x', a: '', hidden: false }] }, { features: 'x' }, { faqs: Array.from({ length: 21 }, () => ({ q: 'q', a: 'a', hidden: false })) }])
      expect((await asAdmin('POST', '/api/admin/content', { ...DEFAULT_CONTENT, ...bad })).status).toBe(400);
    await asAdmin('POST', '/api/admin/content/reset', {});
    expect(((await raw('GET', '/api/public/landing')).body as { content: { heroTitle: string } }).content.heroTitle).toBe(DEFAULT_CONTENT.heroTitle);
  });

  it('a register campaign is served separately from the once-per-account app pop-up', async () => {
    const c = { name: 'Buka kasir', title: 'Promo tahunan', body: '', imageUrl: null, linkUrl: null, ctaLabel: '', showOnLanding: false, showInApp: false, showOnRegister: true, startsAt: T0 - 1, endsAt: T0 + DAY_MS, enabled: true };
    expect((await asAdmin('POST', '/api/admin/campaigns', c)).status).toBe(200);
    const app = (await raw('GET', '/api/public/app')).body as { popup: unknown; registerPopup: { title: string; linkUrl: string | null } };
    expect(app.popup).toBeNull();
    expect(app.registerPopup).toMatchObject({ title: 'Promo tahunan', linkUrl: null });
    expect((await asAdmin('POST', '/api/admin/campaigns', { ...c, showOnRegister: false })).body).toEqual({ error: 'no_placement' });
  });
});

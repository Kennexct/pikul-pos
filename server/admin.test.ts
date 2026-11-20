import { exportJWK, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_FRESH_MS } from './admin';
import { memoryRepo } from './memoryRepo';
import { passSigner } from './pass';
import { route } from './router';
import { DAY_MS, type Deps } from './types';

const T0 = Date.UTC(2026, 10, 20, 3);
const ADMIN = 'owner@kasirku.test';
let now = T0;
let mail: { email: string; code: string }[];
let repo: ReturnType<typeof memoryRepo>;
let deps: Deps;

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
    appOrigin: 'https://kasirku.test',
    adminEmails: [ADMIN],
  };
});

const call = (method: string, path: string, body?: unknown, auth?: string) =>
  route(deps, method, path, auth ? `Bearer ${auth}` : null, body === undefined ? '' : JSON.stringify(body));
async function signIn(email: string) {
  await call('POST', '/api/auth/code', { email });
  const res = await call('POST', '/api/auth/verify', { email, code: mail.at(-1)!.code });
  return (res.body as { refreshToken: string }).refreshToken;
}
const plan = (over: Record<string, unknown> = {}) => ({ id: 'monthly', name: 'Bulanan', amount: 59_000, days: 30, note: 'n', badge: '', features: ['A', ' ', 'B'], active: true, sort: 10, ...over });
const campaign = (over: Record<string, unknown> = {}) => ({
  name: 'Promo 12.12',
  title: 'Diskon akhir tahun',
  body: 'Hemat untuk paket tahunan.',
  imageUrl: null,
  linkUrl: '/app/',
  ctaLabel: 'Coba sekarang',
  showOnLanding: true,
  showInApp: false,
  startsAt: T0 + DAY_MS,
  endsAt: T0 + 10 * DAY_MS,
  enabled: true,
  ...over,
});

describe('admin access', () => {
  it('only allow-listed emails with a fresh session get in', async () => {
    expect((await call('GET', '/api/admin/me')).status).toBe(401);
    const merchant = await signIn('budi@warung.id');
    expect((await call('GET', '/api/admin/catalog', undefined, merchant)).status).toBe(403);
    expect((await call('POST', '/api/admin/plans', plan(), merchant)).status).toBe(403);
    const admin = await signIn(ADMIN);
    expect((await call('GET', '/api/admin/me', undefined, admin)).body).toEqual({ email: ADMIN });
    now += ADMIN_FRESH_MS + 1;
    expect((await call('GET', '/api/admin/me', undefined, admin)).body).toEqual({ error: 'session_too_old' });
  });
});

describe('plans', () => {
  it('edits a plan and the landing page and the app show it', async () => {
    const admin = await signIn(ADMIN);
    const saved = await call('POST', '/api/admin/plans', plan({ days: 31 }), admin);
    expect(saved.status).toBe(200);
    expect(saved.purgePublic).toBe(true);
    expect((saved.body as { plan: { features: string[] } }).plan.features).toEqual(['A', 'B']);
    expect(repo.audit.at(-1)).toMatchObject({ email: ADMIN, action: 'plan.save', target: 'monthly' });
    const pub = (await call('GET', '/api/public/landing')).body as { plans: { id: string; amount: number; days: number }[] };
    expect(pub.plans[0]).toMatchObject({ id: 'monthly', amount: 59_000, days: 31 });
    const m = await signIn('budi@warung.id');
    const ov = (await call('GET', '/api/billing', undefined, m)).body as { plans: { id: string; amount: number }[] };
    expect(ov.plans[0]).toMatchObject({ id: 'monthly', amount: 59_000 });
  });

  it('creates new plans, refuses duplicates and bad values, and hides inactive plans', async () => {
    const admin = await signIn(ADMIN);
    expect((await call('POST', '/api/admin/plans', plan({ id: 'quarterly', name: '3 Bulan', amount: 129_000, days: 90 }), admin)).status).toBe(404);
    expect((await call('POST', '/api/admin/plans', plan({ id: 'quarterly', name: '3 Bulan', amount: 129_000, days: 90, isNew: true }), admin)).status).toBe(200);
    expect((await call('POST', '/api/admin/plans', plan({ isNew: true }), admin)).body).toEqual({ error: 'plan_exists' });
    for (const bad of [{ amount: 500 }, { amount: 1.5 }, { days: 0 }, { name: '' }, { id: 'Bad Id' }, { features: 'x' }, { active: 'yes' }])
      expect((await call('POST', '/api/admin/plans', plan(bad), admin)).status).toBe(400);
    await call('POST', '/api/admin/plans', plan({ id: 'yearly', name: 'Tahunan', amount: 490_000, days: 365, active: false }), admin);
    const pub = (await call('GET', '/api/public/landing')).body as { plans: { id: string }[] };
    expect(pub.plans.map((p) => p.id)).toEqual(['monthly', 'quarterly']);
  });
});

describe('campaigns', () => {
  it('schedules a pop-up: hidden before start, shown while live, gone after end or when switched off', async () => {
    const admin = await signIn(ADMIN);
    const res = await call('POST', '/api/admin/campaigns', campaign(), admin);
    const id = (res.body as { campaign: { id: string; state: string } }).campaign.id;
    expect((res.body as { campaign: { state: string } }).campaign.state).toBe('scheduled');
    const landing = async () => ((await call('GET', '/api/public/landing')).body as { popup: { id: string; linkUrl: string } | null }).popup;
    expect(await landing()).toBeNull();
    now = T0 + 2 * DAY_MS;
    expect(await landing()).toMatchObject({ id, linkUrl: '/app/' });
    expect(((await call('GET', '/api/public/app')).body as { popup: unknown }).popup).toBeNull(); // landing only
    expect((await call('POST', `/api/admin/campaigns/${id}/toggle`, { enabled: false }, admin)).status).toBe(401); // session > 12 h
    now += 61_000;
    const fresh = await signIn(ADMIN);
    expect((await call('POST', `/api/admin/campaigns/${id}/toggle`, { enabled: false }, fresh)).status).toBe(200);
    expect(await landing()).toBeNull();
    await call('POST', `/api/admin/campaigns/${id}/toggle`, { enabled: true }, fresh);
    now = T0 + 10 * DAY_MS;
    expect(await landing()).toBeNull();
  });

  it('can target the merchant app, and archive hides it everywhere', async () => {
    const admin = await signIn(ADMIN);
    const id = ((await call('POST', '/api/admin/campaigns', campaign({ showOnLanding: false, showInApp: true, startsAt: T0 }), admin)).body as { campaign: { id: string } }).campaign.id;
    expect(((await call('GET', '/api/public/app')).body as { popup: { id: string } }).popup.id).toBe(id);
    expect((await call('POST', `/api/admin/campaigns/${id}/archive`, {}, admin)).status).toBe(200);
    expect(((await call('GET', '/api/public/app')).body as { popup: unknown }).popup).toBeNull();
    expect(((await call('GET', '/api/admin/catalog', undefined, admin)).body as { campaigns: unknown[] }).campaigns).toHaveLength(0);
  });

  it('a live promo price is shown with the normal price, only during the campaign', async () => {
    const admin = await signIn(ADMIN);
    expect((await call('POST', '/api/admin/campaigns', campaign({ planId: 'yearly', promoAmount: 490_000 }), admin)).body).toEqual({ error: 'invalid_promo' });
    expect((await call('POST', '/api/admin/campaigns', campaign({ planId: 'yearly', promoAmount: 399_000 }), admin)).status).toBe(200);
    const yearly = async () => ((await call('GET', '/api/public/landing')).body as { plans: { id: string; amount: number; regularAmount: number; promoEndsAt: number | null }[] }).plans.find((p) => p.id === 'yearly');
    expect(await yearly()).toMatchObject({ amount: 490_000, promoEndsAt: null }); // not started yet
    now = T0 + 2 * DAY_MS;
    expect(await yearly()).toMatchObject({ amount: 399_000, regularAmount: 490_000, promoEndsAt: T0 + 10 * DAY_MS });
    now = T0 + 10 * DAY_MS;
    expect(await yearly()).toMatchObject({ amount: 490_000, promoEndsAt: null });
  });

  it('refuses unsafe links, missing placement and bad dates', async () => {
    const admin = await signIn(ADMIN);
    for (const bad of [{ linkUrl: 'javascript:alert(1)' }, { linkUrl: 'http://x.test' }, { linkUrl: '//evil.test' }, { imageUrl: 'data:image/png;base64,AA' }, { showOnLanding: false }, { endsAt: T0 }, { title: '' }])
      expect((await call('POST', '/api/admin/campaigns', campaign(bad), admin)).status).toBe(400);
    expect((await call('POST', '/api/admin/campaigns', campaign({ linkUrl: 'https://wa.me/628123' }), admin)).status).toBe(200);
  });

  it('uploads banner images by content type, refuses others, and serves them', async () => {
    const admin = await signIn(ADMIN);
    const png = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3));
    const up = await call('POST', '/api/admin/images', { data: png }, admin);
    const url = (up.body as { url: string }).url;
    expect(url).toMatch(/^\/api\/public\/images\/[0-9a-f-]{36}$/);
    const got = await call('GET', url);
    expect(got.raw?.contentType).toBe('image/png');
    expect(got.raw?.bytes.length).toBe(11);
    expect((await call('POST', '/api/admin/images', { data: btoa('<svg onload=alert(1)>') }, admin)).status).toBe(400);
    const m = await signIn('budi@warung.id');
    expect((await call('POST', '/api/admin/images', { data: png }, m)).status).toBe(403);
  });
});

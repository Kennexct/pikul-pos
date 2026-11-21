import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Tests run in node: a tiny sessionStorage and window (events + origin) are enough for api.ts. */
function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}
let fetchMock: ReturnType<typeof vi.fn>;
let win: EventTarget & { location: { origin: string } };
beforeEach(() => {
  vi.resetModules();
  win = Object.assign(new EventTarget(), { location: { origin: 'http://localhost' } });
  vi.stubGlobal('window', win);
  vi.stubGlobal('sessionStorage', memoryStorage());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('admin console access (ADR-020)', () => {
  it('asks for the password when the server says signed out, then sends the session token', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'signed_out' }));
    const api = await import('./api');
    expect(await api.openConsole()).toEqual({ mode: 'server', gate: 'login' });
    fetchMock.mockResolvedValueOnce(json(200, { token: 'tok-123', expiresAt: 1 }));
    await api.login('kata-sandi-panjang');
    const [, loginInit] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(String(loginInit.body))).toEqual({ password: 'kata-sandi-panjang' });
    fetchMock.mockResolvedValueOnce(json(200, { now: 1, plans: [], campaigns: [] }));
    await api.loadCatalog();
    const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(path).toBe('/api/admin/catalog');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('reports a wrong password and keeps the login screen', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: 'signed_out' }));
    const api = await import('./api');
    await api.openConsole();
    fetchMock.mockResolvedValueOnce(json(401, { error: 'wrong_password' }));
    await expect(api.login('salah')).rejects.toMatchObject({ code: 'wrong_password' });
  });

  it('says the console is off when ADMIN_PASSWORD is not set', async () => {
    fetchMock.mockResolvedValueOnce(json(503, { error: 'admin_disabled' }));
    const api = await import('./api');
    expect(await api.openConsole()).toEqual({ mode: 'server', gate: 'disabled' });
  });

  it('signs out everywhere when a call comes back 401', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { actor: 'admin:abcd1234' }));
    const api = await import('./api');
    await api.openConsole();
    const seen = vi.fn();
    win.addEventListener(api.SIGNED_OUT_EVENT, seen);
    fetchMock.mockResolvedValueOnce(json(401, { error: 'signed_out' }));
    await expect(api.loadOverview()).rejects.toMatchObject({ status: 401 });
    expect(seen).toHaveBeenCalledTimes(1);
    win.removeEventListener(api.SIGNED_OUT_EVENT, seen);
  });
});

describe('preview mode (no admin server)', () => {
  it('runs the real server code in the tab with example merchants', async () => {
    fetchMock.mockResolvedValue(new Response('<!doctype html>Not found', { status: 404 }));
    const api = await import('./api');
    expect(await api.openConsole()).toEqual({ mode: 'preview', gate: 'ready' });
    const page = await api.loadMerchants({});
    expect(page.total).toBeGreaterThan(10);
    expect(page.rows.every((r) => r.email.endsWith('@pikul.id'))).toBe(true);
    const target = page.rows.find((r) => r.status !== 'paid') ?? page.rows[0];
    if (!target) throw new Error('no merchants');
    const detail = await api.loadMerchant(target.id);
    const before = detail.payments.length;
    await api.recordPayment(target.id, { planId: null, amount: 49_000, days: 30, method: 'qris', reference: 'TEST', paidOn: detail.today, note: '' });
    const after = await api.loadMerchant(target.id);
    expect(after.payments.length).toBe(before + 1);
    expect(after.merchant.status).toBe('paid');
    const report = await api.loadReport('2026-01-01', detail.today);
    expect(report.business.revenue).toBeGreaterThanOrEqual(49_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preview campaigns: create with the register placement, switch off, archive', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    const api = await import('./api');
    await api.openConsole();
    const now = Date.now();
    const input = { name: 'Promo', title: 'Diskon', body: '', imageUrl: null, linkUrl: '/app/', ctaLabel: 'Coba', showOnLanding: false, showInApp: false, showOnRegister: true, startsAt: now - 1_000, endsAt: now + 86_400_000, enabled: true, planId: null, promoAmount: null };
    const { campaign } = await api.saveCampaign(null, input);
    expect(campaign.state).toBe('live');
    expect(campaign.showOnRegister).toBe(true);
    expect((await api.toggleCampaign(campaign.id, false)).campaign.state).toBe('off');
    await api.archiveCampaign(campaign.id);
    expect((await api.loadCatalog()).campaigns.find((c) => c.id === campaign.id)).toBeUndefined();
    await expect(api.uploadImage(new File([], 'a.png'))).rejects.toMatchObject({ code: 'preview_upload' });
  });
});

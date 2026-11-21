import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const plan = { id: 'monthly', name: 'Bulanan', amount: 59_000, days: 30, note: '', badge: '', features: [], active: true, sort: 10 };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('admin console without sign-in (ADR-019)', () => {
  it('uses the server when it answers with a catalog, and sends no Authorization header', async () => {
    fetchMock.mockResolvedValue(json(200, { now: 1, plans: [], campaigns: [] }));
    const api = await import('./api');
    expect((await api.openConsole()).mode).toBe('server');
    fetchMock.mockResolvedValue(json(200, { plan }));
    await api.savePlan(plan);
    const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(path).toBe('/api/admin/plans');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('falls back to preview when there is no admin server (static deploy)', async () => {
    fetchMock.mockResolvedValue(new Response('<!doctype html>Not found', { status: 404 }));
    const api = await import('./api');
    const r = await api.openConsole();
    expect(r.mode).toBe('no_server');
    expect(r.catalog.plans.map((p) => p.id)).toEqual(['monthly', 'yearly']);
    await api.savePlan(plan);
    expect((await api.loadCatalog()).plans.find((p) => p.id === 'monthly')?.amount).toBe(59_000);
    await expect(api.savePlan({ ...plan, amount: 5 })).rejects.toMatchObject({ code: 'invalid_amount' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows preview as locked when the server still wants sign-in', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'signed_out' }));
    const api = await import('./api');
    expect((await api.openConsole()).mode).toBe('locked');
  });

  it('preview campaigns: create, switch off, archive', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    const api = await import('./api');
    await api.openConsole();
    const now = Date.now();
    const input = { name: 'Promo', title: 'Diskon', body: '', imageUrl: null, linkUrl: '/app/', ctaLabel: 'Coba', showOnLanding: true, showInApp: false, startsAt: now - 1_000, endsAt: now + 86_400_000, enabled: true, planId: null, promoAmount: null };
    const { campaign } = await api.saveCampaign(null, input);
    expect(campaign.state).toBe('live');
    expect((await api.toggleCampaign(campaign.id, false)).campaign.state).toBe('off');
    await api.archiveCampaign(campaign.id);
    expect((await api.loadCatalog()).campaigns).toEqual([]);
    await expect(api.uploadImage(new File([], 'a.png'))).rejects.toMatchObject({ code: 'preview_upload' });
  });
});

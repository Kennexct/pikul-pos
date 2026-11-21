import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheRegisterPopup, cachedRegisterPopup, takeRegisterPopupSlot } from './registerPopup';

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
});

const popup = { id: 'c1', title: 'Promo pagi', body: '', imageUrl: null, linkUrl: null, ctaLabel: '', endsAt: 2_000 };

describe('register pop-up (ADR-020)', () => {
  it('keeps the campaign for offline use until it ends', () => {
    cacheRegisterPopup(popup);
    expect(cachedRegisterPopup(1_000)?.id).toBe('c1');
    expect(cachedRegisterPopup(2_000)).toBeNull();
    cacheRegisterPopup(null);
    expect(cachedRegisterPopup(1_000)).toBeNull();
  });

  it('shows at most once per business date', () => {
    expect(takeRegisterPopupSlot('2026-11-21')).toBe(true);
    expect(takeRegisterPopupSlot('2026-11-21')).toBe(false);
    expect(takeRegisterPopupSlot('2026-11-22')).toBe(true);
  });

  it('works without storage (private mode): never throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    expect(() => cacheRegisterPopup(popup)).not.toThrow();
    expect(cachedRegisterPopup(1_000)).toBeNull();
  });
});

import type { CampaignPopup } from './account';

/**
 * Register pop-up (ADR-020): the live "first register opening of the day" campaign is fetched while online and kept
 * here, so it can show right after the register opens even when the signal is weak. Shown at most once per business day.
 */
const CACHE_KEY = 'kk.registerPopup';
const SHOWN_KEY = 'kk.registerPopupShown';

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode: no cache, no once-per-day memory */
  }
};

export function cacheRegisterPopup(p: CampaignPopup | null): void {
  set(CACHE_KEY, p ? JSON.stringify(p) : null);
}

export function cachedRegisterPopup(now: number): CampaignPopup | null {
  try {
    const p = JSON.parse(get(CACHE_KEY) ?? 'null') as CampaignPopup | null;
    return p && typeof p.id === 'string' && typeof p.title === 'string' && p.endsAt > now ? p : null;
  } catch {
    return null;
  }
}

/** True once per business date: the caller shows the pop-up and this remembers the day. */
export function takeRegisterPopupSlot(businessDate: string): boolean {
  if (get(SHOWN_KEY) === businessDate) return false;
  set(SHOWN_KEY, businessDate);
  return true;
}

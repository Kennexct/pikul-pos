import { useEffect, useState } from 'react';
import { APP_EVENTS } from '../../lib/appEvents';
import { appCampaign, BILLING_ENABLED, type CampaignPopup as Popup } from '../../services/account';
import { cachedRegisterPopup, cacheRegisterPopup, takeRegisterPopupSlot } from '../../services/registerPopup';
import { CampaignSheet } from './CampaignPopup';

const FETCH_WAIT_MS = 2_500;

/** Fresh campaign when online (short wait), else the cached one. Never throws. */
async function latest(): Promise<Popup | null> {
  if (navigator.onLine) {
    try {
      const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), FETCH_WAIT_MS));
      const res = await Promise.race([appCampaign(), timeout]);
      if (res) {
        cacheRegisterPopup(res.registerPopup ?? null);
        return res.registerPopup ?? null;
      }
    } catch {
      /* fall back to the cache */
    }
  }
  return cachedRegisterPopup(Date.now());
}

/**
 * ADR-020: the campaign set to "Saat buka kasir pertama hari itu", shown right after the register is opened,
 * at most once per business day on this device. Closing it never blocks selling.
 */
export function RegisterPopup() {
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    if (!BILLING_ENABLED) return undefined;
    let alive = true;
    const onOpened = (e: Event) => {
      const date = (e as CustomEvent<{ businessDate?: string }>).detail?.businessDate;
      if (!date) return;
      void latest().then((p) => {
        if (alive && p && takeRegisterPopupSlot(date)) setPopup(p);
      });
    };
    window.addEventListener(APP_EVENTS.registerOpened, onOpened);
    return () => {
      alive = false;
      window.removeEventListener(APP_EVENTS.registerOpened, onOpened);
    };
  }, []);

  return popup ? <CampaignSheet popup={popup} onClose={() => setPopup(null)} /> : null;
}

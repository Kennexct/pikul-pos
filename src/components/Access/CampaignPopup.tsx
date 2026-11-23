import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { appCampaign, BILLING_ENABLED, type CampaignPopup as Popup } from '../../services/account';
import { useAccessStore } from '../../store/useAccessStore';
import { cacheRegisterPopup } from '../../services/registerPopup';
import { t } from '../../i18n';
import { btnPrimary } from '../ui/styles';
import { Sheet } from '../ui/Sheet';
import { BannerDialog } from './BannerDialog';

const SEEN_KEY = 'kk.campaignsSeen';

/** Campaign ids already shown, per account on this device. */
function seen(): Record<string, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}
function markSeen(account: string, id: string) {
  const all = seen();
  all[account] = [...(all[account] ?? []).filter((x) => x !== id), id].slice(-50);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    /* private mode: may show again next time */
  }
}

/** Opens a campaign link: app paths stay in the tab, everything else opens a new one. */
function openLink(url: string) {
  if (url.startsWith('/')) window.location.assign(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * ADR-014: the live in-app campaign from the admin console, shown once per merchant account
 * after sign-in (or on the next app open). Online only; offline selling never waits on it.
 */
export function CampaignPopup() {
  const account = useAccessStore((s) => s.claims?.sub ?? null);
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    if (!BILLING_ENABLED || !account || !navigator.onLine) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      appCampaign()
        .then(({ popup: p, registerPopup }) => {
          cacheRegisterPopup(registerPopup ?? null);
          if (!alive || !p || (seen()[account] ?? []).includes(p.id)) return;
          markSeen(account, p.id);
          setPopup(p);
        })
        .catch(() => undefined);
    }, 1_500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [account]);

  return popup ? <CampaignSheet popup={popup} onClose={() => setPopup(null)} /> : null;
}

/**
 * The pop-up shared by the account pop-up and the register pop-up. With a banner image it shows the banner alone,
 * large and uncropped (clickable when it has a link); without one it falls back to the title, text and button.
 */
export function CampaignSheet({ popup, onClose }: { popup: Popup; onClose: () => void }) {
  const [isImageBroken, setIsImageBroken] = useState(false);
  const close = onClose;
  const go = () => {
    if (popup.linkUrl) openLink(popup.linkUrl);
    close();
  };

  if (popup.imageUrl && !isImageBroken) {
    const link = popup.linkUrl;
    return (
      <BannerDialog
        title={popup.title}
        imageUrl={popup.imageUrl}
        onOpen={link ? () => openLink(link) : undefined}
        onClose={close}
        onError={() => setIsImageBroken(true)}
      />
    );
  }

  return (
    <Sheet
      title={popup.title}
      isOpen
      onClose={close}
      footer={
        popup.linkUrl ? (
          <button type="button" className={`${btnPrimary} w-full`} onClick={go}>
            {popup.ctaLabel || t('Lihat promo')}
            {!popup.linkUrl.startsWith('/') && <ExternalLink aria-hidden size={18} />}
          </button>
        ) : undefined
      }
    >
      {popup.body && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{popup.body}</p>}
    </Sheet>
  );
}

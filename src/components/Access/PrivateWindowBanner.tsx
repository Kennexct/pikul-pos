import { EyeOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { privateWindow } from '../../services/deviceHello';
import { t } from '../../i18n';

const DISMISS_KEY = 'kk.privateWindow.dismissed';

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Warns that this window looks private / incognito (v0.20.1): the browser wipes the device's data when it closes,
 * so sales not synced yet would be lost and the device leaves an unusable entry in the device list.
 * `card` sits above the sign-in form; `strip` sits on top of the app. Dismissed for this window only.
 */
export function PrivateWindowBanner({ variant = 'strip' }: { variant?: 'strip' | 'card' }) {
  const [isPrivate, setIsPrivate] = useState(false);
  const [dismissed, setDismissed] = useState(wasDismissed);
  useEffect(() => {
    let live = true;
    void privateWindow().then((v) => live && setIsPrivate(v));
    return () => {
      live = false;
    };
  }, []);
  if (!isPrivate || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // private windows may refuse storage; hiding for this page view is enough
    }
  };
  const frame =
    variant === 'card'
      ? 'mb-4 w-full max-w-[440px] rounded-xl border border-warn-200 bg-warn-50 p-4'
      : 'border-b border-warn-200 bg-warn-50 px-4 py-2.5';
  return (
    <div role="status" className={`flex items-start gap-3 text-[14px] text-warn-700 ${frame}`}>
      <EyeOff aria-hidden size={18} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{t('Sepertinya ini jendela penyamaran.')}</span>{' '}
        {t('Data di perangkat ini hilang saat browser ditutup, termasuk penjualan yang belum tersinkron. Pakai jendela biasa atau pasang aplikasi Pikul.')}
      </p>
      <button type="button" onClick={dismiss} aria-label={t('Tutup peringatan')} className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-warn-200/40">
        <X aria-hidden size={18} />
      </button>
    </div>
  );
}

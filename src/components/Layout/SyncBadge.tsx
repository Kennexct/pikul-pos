import { CloudCheck, CloudOff, HardDrive, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BILLING_ENABLED } from '../../services/account';
import { useSessionStore } from '../../store/useSessionStore';
import { t } from '../../i18n';

interface SyncState {
  icon: LucideIcon;
  label: string;
  hint: string;
  tone: string;
}

function useSyncState(): SyncState {
  const isOnline = useSessionStore((s) => s.isOnline);
  const pending = useSessionStore((s) => s.pendingSyncCount);
  const status = useSessionStore((s) => s.syncStatus);

  if (!BILLING_ENABLED) {
    return { icon: HardDrive, label: t('Lokal'), hint: t('Server belum diatur — data tersimpan di perangkat ini'), tone: 'text-muted' };
  }
  if (!isOnline) {
    return { icon: CloudOff, label: t('Offline'), hint: t('Penjualan tetap tersimpan dan akan dikirim saat online'), tone: 'text-warn-700' };
  }
  if (status === 'error' || status === 'mismatch' || status === 'signedOut') {
    return { icon: CloudOff, label: t('Tertunda'), hint: t('Sinkronisasi tertunda. Data aman di perangkat.'), tone: 'text-warn-700' };
  }
  if (pending > 0) {
    return { icon: RefreshCw, label: t('{0} antre', pending), hint: t('{0} data menunggu dikirim', pending), tone: 'text-muted' };
  }
  return { icon: CloudCheck, label: t('Tersinkron'), hint: t('Semua data sudah tersimpan di server'), tone: 'text-brand-700' };
}

export function SyncBadge({ variant = 'stacked' }: { variant?: 'stacked' | 'inline' }) {
  const { icon: Icon, label, hint, tone } = useSyncState();

  if (variant === 'inline') {
    return (
      <span role="status" title={hint} className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${tone}`}>
        <Icon aria-hidden size={16} /> {label}
      </span>
    );
  }
  return (
    <div role="status" title={hint} className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${tone}`}>
      <Icon aria-hidden size={18} />
      {label}
    </div>
  );
}

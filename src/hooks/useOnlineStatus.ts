import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { SYNC_INTERVAL_MS } from '../constants';
import { pendingCount } from '../services/sync';
import { syncTick } from '../services/syncBinding';
import { useSessionStore } from '../store/useSessionStore';
import { t } from '../i18n';

/** Tracks connectivity and runs the background sync loop (ADR-024): push, then pull, every 15 s while visible. */
export function useOnlineStatus(): void {
  const setOnline = useSessionStore((s) => s.setOnline);
  const setPendingSyncCount = useSessionStore((s) => s.setPendingSyncCount);
  const setSyncStatus = useSessionStore((s) => s.setSyncStatus);

  useEffect(() => {
    let warned = false;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const outcome = await syncTick();
      setSyncStatus(outcome);
      if (outcome === 'error' && !warned) {
        warned = true;
        toast.error(t('Sinkronisasi tertunda. Data aman di perangkat.'));
      }
      if (outcome === 'synced') warned = false;
      setPendingSyncCount(await pendingCount());
    };
    const handleOnline = () => {
      setOnline(true);
      void tick();
    };
    const handleOffline = () => {
      setOnline(false);
      toast(t('Offline — penjualan tetap tersimpan di perangkat'));
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);
    const timer = window.setInterval(() => void tick(), SYNC_INTERVAL_MS);
    void tick();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
      window.clearInterval(timer);
    };
  }, [setOnline, setPendingSyncCount, setSyncStatus]);
}

import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { btnPrimary, helperText } from '../../components/ui/styles';
import { getDeviceId } from '../../services/device';
import { lastSyncedAt, pendingCount, rejectedCount } from '../../services/sync';
import { cachedDevices, refreshDevices, syncTick, type SyncDevice } from '../../services/syncBinding';
import { useSessionStore, type SyncStatus } from '../../store/useSessionStore';
import { DeviceList } from './DeviceList';
import { SettingsSection } from './SettingsSection';
import { DATE_LOCALE, t } from '../../i18n';

const dateTime = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function statusLine(status: SyncStatus, pending: number, lastAt: string | null): string {
  if (status === 'offline') return pending > 0 ? t('Offline. {0} perubahan menunggu internet.', pending) : t('Offline. Data aman di perangkat.');
  if (status === 'error' || status === 'signedOut') return t('Sinkronisasi tertunda. Data aman di perangkat.');
  if (pending > 0) return t('{0} perubahan menunggu dikirim.', pending);
  return lastAt ? t('Tersinkron {0}.', dateTime.format(new Date(lastAt))) : t('Belum pernah tersinkron.');
}

/** Settings → Sinkronisasi (ADR-025): status, "Sinkronkan sekarang", and the devices on this account. */
export function SyncSettings() {
  const status = useSessionStore((s) => s.syncStatus);
  const setSyncStatus = useSessionStore((s) => s.setSyncStatus);
  const info = useLiveQuery(async () => ({ pending: await pendingCount(), rejected: await rejectedCount(), lastAt: await lastSyncedAt(), me: await getDeviceId() }), []);
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void cachedDevices().then(setDevices);
    void refreshDevices().then(setDevices);
  }, []);

  const syncNow = async () => {
    setBusy(true);
    const outcome = await syncTick();
    setSyncStatus(outcome);
    setDevices(await refreshDevices());
    setBusy(false);
    if (outcome === 'synced') toast.success(t('Data sudah tersinkron.'));
    else if (outcome === 'offline') toast(t('Offline — penjualan tetap tersimpan di perangkat'));
    else toast.error(t('Sinkronisasi tertunda. Data aman di perangkat.'));
  };

  if (!info) return null;
  return (
    <>
      <SettingsSection title={t('Sinkronisasi')} description={t('Data toko dikirim ke server Pikul dan diambil oleh perangkat lain yang masuk dengan akun ini. Penjualan tetap jalan tanpa internet.')}>
        <p role="status" className="text-[15px] font-semibold">
          {statusLine(status, info.pending, info.lastAt)}
        </p>
        {info.rejected > 0 && <p className={helperText}>{t('{0} data ditolak server dan tidak dikirim. Hubungi Pikul bila ini terus muncul.', info.rejected)}</p>}
        <button type="button" disabled={busy} onClick={() => void syncNow()} className={`${btnPrimary} mt-3`}>
          <RefreshCw aria-hidden size={17} className={busy ? 'animate-spin' : ''} /> {t('Sinkronkan sekarang')}
        </button>
      </SettingsSection>

      <SettingsSection title={t('Perangkat')} description={t('Setiap perangkat punya laci kas sendiri. Nama perangkat tampil di Kas → Semua perangkat.')}>
        <DeviceList devices={devices} me={info.me} onChange={setDevices} />
      </SettingsSection>
    </>
  );
}

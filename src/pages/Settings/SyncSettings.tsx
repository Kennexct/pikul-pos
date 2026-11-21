import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { badgeBrand, btnPrimary, btnSecondary, helperText, inputBase } from '../../components/ui/styles';
import { getDeviceId } from '../../services/device';
import { lastSyncedAt, pendingCount, rejectedCount } from '../../services/sync';
import { cachedDevices, refreshDevices, renameDevice, syncTick, type SyncDevice } from '../../services/syncBinding';
import { useSessionStore, type SyncStatus } from '../../store/useSessionStore';
import { SettingsSection } from './SettingsSection';
import { DATE_LOCALE, t } from '../../i18n';

const dateTime = new Intl.DateTimeFormat(DATE_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function statusLine(status: SyncStatus, pending: number, lastAt: string | null): string {
  if (status === 'offline') return pending > 0 ? t('Offline. {0} perubahan menunggu internet.', pending) : t('Offline. Data aman di perangkat.');
  if (status === 'error' || status === 'signedOut') return t('Sinkronisasi tertunda. Data aman di perangkat.');
  if (pending > 0) return t('{0} perubahan menunggu dikirim.', pending);
  return lastAt ? t('Tersinkron {0}.', dateTime.format(new Date(lastAt))) : t('Belum pernah tersinkron.');
}

/** Settings → Sinkronisasi (ADR-024): status, "Sinkronkan sekarang", and the devices on this account. */
export function SyncSettings() {
  const status = useSessionStore((s) => s.syncStatus);
  const setSyncStatus = useSessionStore((s) => s.setSyncStatus);
  const info = useLiveQuery(async () => ({ pending: await pendingCount(), rejected: await rejectedCount(), lastAt: await lastSyncedAt(), me: await getDeviceId() }), []);
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');

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

  const saveName = async (deviceId: string) => {
    try {
      setDevices(await renameDevice(deviceId, name));
      setEditing(null);
    } catch {
      toast.error(t('Nama perangkat 1–30 huruf, dan perlu internet.'));
    }
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
        {devices.length === 0 && <p className={helperText}>{t('Daftar perangkat muncul setelah sinkronisasi pertama.')}</p>}
        <ul className="flex flex-col divide-y divide-line">
          {devices.map((d) => (
            <li key={d.deviceId} className="flex min-h-12 items-center gap-2 py-2">
              {editing === d.deviceId ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveName(d.deviceId);
                  }}
                >
                  <input aria-label={t('Nama perangkat')} autoFocus maxLength={30} value={name} onChange={(e) => setName(e.target.value)} className={inputBase} />
                  <button type="submit" className={btnSecondary}>
                    {t('Simpan')}
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{d.name}</span>
                  {d.deviceId === info.me && <span className={badgeBrand}>{t('Perangkat ini')}</span>}
                  <span className="num text-[12px] text-muted">{dateTime.format(new Date(d.lastSeen))}</span>
                  <button
                    type="button"
                    aria-label={t('Ganti nama {0}', d.name)}
                    onClick={() => {
                      setEditing(d.deviceId);
                      setName(d.name);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-subtle"
                  >
                    <Pencil aria-hidden size={16} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </SettingsSection>
    </>
  );
}

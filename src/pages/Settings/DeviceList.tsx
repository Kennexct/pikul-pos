import { Laptop, Pencil, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { badgeBrand, badgeNeutral, badgeWarn, btnDangerSolid, btnSecondary, helperText, inputBase } from '../../components/ui/styles';
import { deviceKind } from '../../lib/deviceLabel';
import { inactiveDays, lastActiveText, sortDevices } from '../../lib/lastActive';
import { removeDevice, renameDevice, type SyncDevice } from '../../services/syncBinding';
import { t } from '../../i18n';

const ICONS = { phone: Smartphone, tablet: Tablet, computer: Laptop };
const iconBtn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle';

interface Props {
  devices: SyncDevice[];
  me: string;
  onChange: (devices: SyncDevice[]) => void;
}

/**
 * Pengaturan → Sinkronisasi → Perangkat (v0.20.1): each device named by browser and system until renamed,
 * "Perangkat ini" on this one, last active, private-window and 7-day-inactive flags, rename and remove.
 */
export function DeviceList({ devices, me, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [name, setName] = useState('');
  const now = Date.now();

  const saveName = async (deviceId: string) => {
    try {
      onChange(await renameDevice(deviceId, name));
      setEditing(null);
    } catch {
      toast.error(t('Nama perangkat 1–30 huruf, dan perlu internet.'));
    }
  };

  const remove = async (d: SyncDevice) => {
    try {
      onChange(await removeDevice(d.deviceId));
      setRemoving(null);
      toast.success(t('{0} dihapus dari daftar.', d.name));
    } catch {
      toast.error(t('Perangkat belum terhapus. Perlu internet, coba lagi.'));
    }
  };

  if (devices.length === 0) return <p className={helperText}>{t('Daftar perangkat muncul setelah sinkronisasi pertama.')}</p>;
  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {sortDevices(devices, me).map((d) => {
          const isMe = d.deviceId === me;
          const quiet = inactiveDays(d.lastSeen, now);
          const Icon = ICONS[deviceKind(d.autoName ?? '')];
          if (editing === d.deviceId) {
            return (
              <li key={d.deviceId} className="py-2">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveName(d.deviceId);
                  }}
                >
                  <input aria-label={t('Nama perangkat')} autoFocus maxLength={30} value={name} placeholder={t('Contoh: Kasir depan')} onChange={(e) => setName(e.target.value)} className={inputBase} />
                  <button type="submit" className={btnSecondary}>
                    {t('Simpan')}
                  </button>
                </form>
              </li>
            );
          }
          if (removing === d.deviceId) {
            return (
              <li key={d.deviceId} className="flex flex-col gap-2 py-3" role="group" aria-label={t('Hapus {0}', d.name)}>
                <p className="text-[14px]">
                  <span className="font-semibold">{t('Hapus {0} dari daftar?', d.name)}</span> {t('Data toko tidak ikut terhapus. Kalau perangkat ini masih dipakai, ia muncul lagi saat sinkron berikutnya.')}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRemoving(null)} className={btnSecondary}>
                    {t('Batal')}
                  </button>
                  <button type="button" onClick={() => void remove(d)} className={btnDangerSolid}>
                    {t('Hapus')}
                  </button>
                </div>
              </li>
            );
          }
          const details = [d.named && d.autoName ? d.autoName : '', lastActiveText(d.lastSeen, now), d.receiptCode ? t('Kode struk {0}', d.receiptCode) : ''].filter(Boolean);
          return (
            <li key={d.deviceId} className="flex items-center gap-3 py-2.5">
              <Icon aria-hidden size={20} className={`shrink-0 ${quiet ? 'text-muted' : 'text-ink-soft'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`min-w-0 truncate text-[15px] font-semibold ${quiet ? 'text-ink-soft' : ''}`}>{d.name}</span>
                  {isMe && <span className={badgeBrand}>{t('Perangkat ini')}</span>}
                  {d.privateMode && <span className={badgeWarn}>{t('Jendela penyamaran')}</span>}
                  {quiet !== null && <span className={badgeNeutral}>{t('Tidak aktif {0} hari', quiet)}</span>}
                </div>
                <p className="mt-0.5 text-[13px] text-muted">{details.join(' · ')}</p>
              </div>
              <button
                type="button"
                aria-label={t('Ganti nama {0}', d.name)}
                onClick={() => {
                  setEditing(d.deviceId);
                  setName(d.named ? d.name : '');
                }}
                className={iconBtn}
              >
                <Pencil aria-hidden size={16} />
              </button>
              {isMe ? (
                <span aria-hidden className="w-11 shrink-0" />
              ) : (
                <button type="button" aria-label={t('Hapus {0}', d.name)} onClick={() => setRemoving(d.deviceId)} className={`${iconBtn} hover:text-danger-700`}>
                  <Trash2 aria-hidden size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className={helperText}>
        {t('Masuk lagi di browser mana pun? Perangkat itu ditambahkan sebagai perangkat baru dan data toko diunduh dari akun. Hapus perangkat lama yang tidak dipakai lagi; data toko tidak ikut terhapus.')}
      </p>
    </>
  );
}

import { t } from '../i18n';

/** "Aktif 5 menit lalu" and the 7-day inactive flag for Pengaturan → Sinkronisasi → Perangkat. */

export const INACTIVE_DAYS = 7;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function lastActiveText(lastSeen: number, now: number): string {
  const ago = Math.max(0, now - lastSeen);
  if (ago < 2 * MINUTE) return t('Aktif sekarang');
  if (ago < HOUR) return t('Aktif {0} menit lalu', Math.floor(ago / MINUTE));
  if (ago < DAY) return t('Aktif {0} jam lalu', Math.floor(ago / HOUR));
  const days = Math.floor(ago / DAY);
  return days === 1 ? t('Aktif kemarin') : t('Aktif {0} hari lalu', days);
}

/** Whole days without contact once that reaches INACTIVE_DAYS, else null. */
export function inactiveDays(lastSeen: number, now: number): number | null {
  const days = Math.floor((now - lastSeen) / DAY);
  return days >= INACTIVE_DAYS ? days : null;
}

/** This device first, then the others by most recently active; inactive ones sink to the bottom by that order too. */
export function sortDevices<T extends { deviceId: string; lastSeen: number }>(devices: T[], me: string): T[] {
  return [...devices].sort((a, b) => Number(b.deviceId === me) - Number(a.deviceId === me) || b.lastSeen - a.lastSeen);
}

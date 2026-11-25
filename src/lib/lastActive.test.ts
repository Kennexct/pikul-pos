import { describe, expect, it } from 'vitest';
import { inactiveDays, lastActiveText, sortDevices } from './lastActive';

const NOW = Date.UTC(2026, 10, 25, 5);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe('last active', () => {
  it('reads like a person would say it', () => {
    expect(lastActiveText(NOW - 30_000, NOW)).toBe('Aktif sekarang');
    expect(lastActiveText(NOW - 5 * MIN, NOW)).toBe('Aktif 5 menit lalu');
    expect(lastActiveText(NOW - 3 * 60 * MIN, NOW)).toBe('Aktif 3 jam lalu');
    expect(lastActiveText(NOW - DAY - MIN, NOW)).toBe('Aktif kemarin');
    expect(lastActiveText(NOW - 9 * DAY, NOW)).toBe('Aktif 9 hari lalu');
    expect(lastActiveText(NOW + MIN, NOW)).toBe('Aktif sekarang'); // a clock a little ahead
  });
  it('flags devices quiet for 7 days or more', () => {
    expect(inactiveDays(NOW - 6 * DAY, NOW)).toBeNull();
    expect(inactiveDays(NOW - 7 * DAY, NOW)).toBe(7);
  });
  it('puts this device first, then the most recently active', () => {
    const list = [
      { deviceId: 'old', lastSeen: NOW - 9 * DAY },
      { deviceId: 'me', lastSeen: NOW - 2 * DAY },
      { deviceId: 'new', lastSeen: NOW },
    ];
    expect(sortDevices(list, 'me').map((d) => d.deviceId)).toEqual(['me', 'new', 'old']);
  });
});

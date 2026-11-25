/**
 * A name a person recognises for a device, from its browser's user agent: "Chrome · Android", "Safari · iPad".
 * Used as the default name in Pengaturan → Sinkronisasi until the owner renames the device. Pure, so it is unit tested.
 */

const BROWSERS: Array<[RegExp, string]> = [
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/EdgA?\/|EdgiOS\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

function systemOf(ua: string, maxTouchPoints: number): string {
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android' : 'Tablet Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  // iPadOS asks for desktop sites and says "Macintosh"; a touch screen gives it away.
  if (/Macintosh|Mac OS X/.test(ua)) return maxTouchPoints > 1 ? 'iPad' : 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return '';
}

export function describeDevice(ua: string, maxTouchPoints = 0): string {
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? '';
  const system = systemOf(ua, maxTouchPoints);
  return [browser, system].filter(Boolean).join(' · ');
}

/** Phone, tablet or computer, for the icon next to a device's name. */
export function deviceKind(autoName: string): 'phone' | 'tablet' | 'computer' {
  if (/iPad|Tablet/.test(autoName)) return 'tablet';
  if (/Android|iPhone/.test(autoName)) return 'phone';
  return 'computer';
}

import { describeDevice } from '../lib/deviceLabel';
import { isPrivateWindow } from '../lib/privateWindow';
import { getDeviceId, getReceiptCode } from './device';
import { version } from '../../package.json';

/** What this device tells the sync server about itself on every push and pull (ADR-025, v0.20.1 names). */

let privateCheck: Promise<boolean> | null = null;

/** Checked once per page load; never throws. */
export function privateWindow(): Promise<boolean> {
  privateCheck ??= (async () => {
    try {
      const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
      const memory = (globalThis.performance as { memory?: { jsHeapSizeLimit?: number } } | undefined)?.memory;
      return await isPrivateWindow({
        getDirectory: storage?.getDirectory ? () => storage.getDirectory() : undefined,
        estimate: storage?.estimate ? () => storage.estimate() : undefined,
        heapLimit: memory?.jsHeapSizeLimit,
      });
    } catch {
      return false;
    }
  })();
  return privateCheck;
}

export function autoDeviceName(): string {
  if (typeof navigator === 'undefined') return '';
  return describeDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

export async function deviceHello() {
  return {
    deviceId: await getDeviceId(),
    receiptCode: await getReceiptCode(),
    appVersion: version,
    autoName: autoDeviceName(),
    privateMode: await privateWindow(),
  };
}

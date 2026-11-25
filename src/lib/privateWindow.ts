/**
 * Best guess whether the app runs in a private / incognito window, where IndexedDB is wiped when the browser closes.
 * Browsers do not say so directly, so this uses the signs they leave (same checks as the common detectors):
 * - Safari and Firefox refuse the origin private file system in a private window.
 * - Chrome and other Chromium browsers give a private window a storage quota smaller than twice the JS heap limit.
 * Pure over the given environment, so it is unit tested.
 */
export interface StorageEnv {
  getDirectory?: () => Promise<unknown>;
  estimate?: () => Promise<{ quota?: number }>;
  /** performance.memory.jsHeapSizeLimit, only in Chromium browsers. */
  heapLimit?: number;
}

export async function isPrivateWindow(env: StorageEnv): Promise<boolean> {
  if (env.getDirectory) {
    try {
      await env.getDirectory();
    } catch (error) {
      const e = error as { name?: string; message?: string };
      if (e?.name === 'SecurityError' || /unknown transient reason/i.test(e?.message ?? '')) return true;
    }
  }
  if (env.heapLimit && env.estimate) {
    try {
      const { quota } = await env.estimate();
      if (typeof quota === 'number' && quota > 0 && quota < env.heapLimit * 2) return true;
    } catch {
      return false;
    }
  }
  return false;
}

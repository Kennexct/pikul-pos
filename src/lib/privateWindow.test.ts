import { describe, expect, it } from 'vitest';
import { isPrivateWindow } from './privateWindow';

const GB = 1024 ** 3;
const ok = async () => ({});
const refuse = (name: string, message = '') => async () => {
  throw Object.assign(new Error(message), { name });
};

describe('isPrivateWindow', () => {
  it('Safari and Firefox private windows refuse the private file system', async () => {
    expect(await isPrivateWindow({ getDirectory: refuse('UnknownError', 'The operation failed for an unknown transient reason') })).toBe(true);
    expect(await isPrivateWindow({ getDirectory: refuse('SecurityError', 'Security error when calling GetDirectory') })).toBe(true);
    expect(await isPrivateWindow({ getDirectory: refuse('NotAllowedError') })).toBe(false);
    expect(await isPrivateWindow({ getDirectory: ok })).toBe(false);
  });
  it('Chromium incognito has a quota under twice the heap limit', async () => {
    const heapLimit = 4 * GB;
    expect(await isPrivateWindow({ getDirectory: ok, heapLimit, estimate: async () => ({ quota: 2 * GB }) })).toBe(true);
    expect(await isPrivateWindow({ getDirectory: ok, heapLimit, estimate: async () => ({ quota: 60 * GB }) })).toBe(false);
  });
  it('says no when it cannot tell', async () => {
    expect(await isPrivateWindow({})).toBe(false);
    expect(await isPrivateWindow({ estimate: async () => ({ quota: 1 }) })).toBe(false); // no heap limit: not Chromium
    expect(await isPrivateWindow({ heapLimit: GB, estimate: async () => Promise.reject(new Error('x')) })).toBe(false);
  });
});

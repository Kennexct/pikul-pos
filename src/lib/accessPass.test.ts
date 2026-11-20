import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { accessState, DAY_MS, monotonicNow, verifyPass } from './accessPass';

const T = Date.UTC(2026, 10, 19);

describe('accessState', () => {
  const base = { sub: 'a', email: 'x@y.id', plan: 'trial' as const, until: T + 14 * DAY_MS, iat: T };
  it('active, with a warning in the last 3 days', () => {
    expect(accessState(base, T)).toMatchObject({ kind: 'active', warn: false });
    expect(accessState(base, T + 12 * DAY_MS)).toMatchObject({ kind: 'active', warn: true });
  });
  it('3-day grace only when the server never confirmed the expiry', () => {
    expect(accessState(base, T + 15 * DAY_MS)).toMatchObject({ kind: 'grace' });
    expect(accessState(base, T + 17 * DAY_MS + 1)).toMatchObject({ kind: 'expired' });
    expect(accessState({ ...base, iat: T + 14 * DAY_MS + 1 }, T + 15 * DAY_MS)).toMatchObject({ kind: 'expired' });
  });
  it('clock rollback does not bring time back', () => {
    expect(monotonicNow(T, T + DAY_MS)).toBe(T + DAY_MS);
  });
});

describe('verifyPass', () => {
  it('accepts a pass signed by the server key and rejects other keys and tampering', async () => {
    const kp = await generateKeyPair('ES256', { extractable: true });
    const other = await generateKeyPair('ES256', { extractable: true });
    const pub = await exportJWK(kp.publicKey);
    const sign = (key: CryptoKey | Uint8Array, claims: Record<string, unknown> = { email: 'x@y.id', plan: 'paid', until: T }) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'ES256' }).setSubject('acc').setIssuer('pikul').setIssuedAt().setExpirationTime('30d').sign(key);
    const good = await sign(kp.privateKey);
    expect(await verifyPass(good, pub)).toMatchObject({ sub: 'acc', plan: 'paid', until: T });
    expect(await verifyPass(await sign(other.privateKey), pub)).toBeNull();
    const [h, , s] = good.split('.');
    const forged = `${h}.${btoa(JSON.stringify({ sub: 'acc', iss: 'pikul', email: 'x', plan: 'paid', until: T * 2, iat: 1 })).replace(/=+$/, '')}.${s}`;
    expect(await verifyPass(forged, pub)).toBeNull();
    expect(await verifyPass(await sign(kp.privateKey, { email: 'x', plan: 'gold', until: T }), pub)).toBeNull();
  });
});

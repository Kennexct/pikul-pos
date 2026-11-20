import { decodeJwt, importJWK, jwtVerify, type JWK } from 'jose';

export const DAY_MS = 86_400_000;
export const GRACE_MS = 3 * DAY_MS;
export const WARN_MS = 3 * DAY_MS;

export interface PassClaims {
  sub: string;
  email: string;
  plan: 'trial' | 'paid';
  until: number; // entitlement end, epoch ms
  iat: number; // issued at, epoch ms
}

export type AccessState =
  | { kind: 'active'; plan: 'trial' | 'paid'; until: number; msLeft: number; warn: boolean }
  | { kind: 'grace'; plan: 'trial' | 'paid'; until: number; graceEnds: number }
  | { kind: 'expired'; plan: 'trial' | 'paid'; until: number };

/** Verifies the ES256 signature with the public key built into the app. Expired-JWT is fine: `until` decides. */
export async function verifyPass(token: string, publicJwk: JWK): Promise<PassClaims | null> {
  try {
    const key = await importJWK(publicJwk, 'ES256');
    const { payload } = await jwtVerify(token, key, { issuer: 'pikul', algorithms: ['ES256'], clockTolerance: 400 * 86_400 });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.until !== 'number' || typeof payload.iat !== 'number') return null;
    if (payload.plan !== 'trial' && payload.plan !== 'paid') return null;
    return { sub: payload.sub, email: payload.email, plan: payload.plan, until: payload.until, iat: payload.iat * 1000 };
  } catch {
    return null;
  }
}

/** Unverified read, for showing the email on the sign-out button only. */
export const peekEmail = (token: string): string | null => {
  try {
    const e = decodeJwt(token).email;
    return typeof e === 'string' ? e : null;
  } catch {
    return null;
  }
};

/**
 * ADR-013: the device decides on its own.
 * Grace applies only when the server has not yet confirmed the expiry (the pass was issued before `until`).
 */
export function accessState(c: PassClaims, now: number): AccessState {
  if (now < c.until) {
    const msLeft = c.until - now;
    return { kind: 'active', plan: c.plan, until: c.until, msLeft, warn: msLeft <= WARN_MS };
  }
  const graceEnds = c.until + GRACE_MS;
  if (c.iat < c.until && now < graceEnds) return { kind: 'grace', plan: c.plan, until: c.until, graceEnds };
  return { kind: 'expired', plan: c.plan, until: c.until };
}

/** Clock-rollback guard: never let "now" go backwards past the last time this device saw. */
export const monotonicNow = (deviceNow: number, lastSeen: number) => Math.max(deviceNow, lastSeen);

export const daysLeft = (ms: number) => Math.max(0, Math.ceil(ms / DAY_MS));

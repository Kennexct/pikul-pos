import { safeEqual } from './crypto';

/** Password hashing (ADR-023): PBKDF2-SHA256 via WebCrypto, so it runs the same on Vercel (Node), in tests and in browsers. */
export const PBKDF2_ITERATIONS = 210_000;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

const enc = new TextEncoder();
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => {
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(16);
  }
};

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations }, key, 256);
  return new Uint8Array(bits);
}

export const isValidPassword = (v: unknown): v is string => typeof v === 'string' && v.length >= MIN_PASSWORD && v.length <= MAX_PASSWORD;

/** Format: `pbkdf2$<iterations>$<salt b64>$<hash b64>`. */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ['pbkdf2', String(iterations), toB64(salt), toB64(await derive(password, salt, iterations))].join('$');
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? '').split('$');
  const iterations = Number(parts[1]);
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 1_000 || iterations > 2_000_000) {
    await derive(password, new Uint8Array(16), PBKDF2_ITERATIONS); // same work as a real check: unknown emails do not answer faster
    return false;
  }
  const got = await derive(password, fromB64(parts[2] ?? ''), iterations);
  return safeEqual(toB64(got), parts[3] ?? '');
}

/** 12 characters without look-alikes (0/O, 1/l/I), for the admin's "temporary password". */
export function temporaryPassword(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const limit = 256 - (256 % abc.length);
  let out = '';
  while (out.length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(24))) if (b < limit && out.length < 12) out += abc[b % abc.length];
  }
  return out;
}

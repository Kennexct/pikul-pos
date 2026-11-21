const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export const sha512 = async (s: string) => hex(await crypto.subtle.digest('SHA-512', enc.encode(s)));

export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Uniform 6-digit code (rejection sampling, no modulo bias). */
export function randomCode(): string {
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? limit;
    if (n < limit) return String(n % 1_000_000).padStart(6, '0');
  }
}

/** Constant-time compare for equal-length hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

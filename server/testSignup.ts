import { route } from './router';
import type { Deps } from './types';

/** Test helper: signs a merchant up (or in, when the email exists) and returns the session body. Each call uses its own IP. */
let n = 0;
export async function signUpOrIn(deps: Deps, email: string, password = 'rahasia-123') {
  const ctx = () => ({ ip: `192.0.2.${(n++ % 250) + 1}`, query: new URLSearchParams() });
  const profile = { ownerName: 'Budi Santoso', storeName: `Toko ${email.split('@')[0] ?? ''}`, phone: '0812 3456 7890', city: 'Bandung' };
  const up = await route(deps, 'POST', '/api/auth/signup', null, JSON.stringify({ email, password, ...profile }), ctx());
  if (up.status === 200) return up;
  return route(deps, 'POST', '/api/auth/login', null, JSON.stringify({ email, password }), ctx());
}

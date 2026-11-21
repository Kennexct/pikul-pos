# Senior engineer — vercel-neon-launch
- PBKDF2 via `crypto.subtle.deriveBits` works in Node 22, browsers and tests.
- Lockout reuses `countRate/addRate` (ADR-020). Same error `wrong_credentials` for unknown email and wrong password; still hash a dummy to keep timing similar.
- Adapter reads body as text (limit enforced by router), passes `x-real-ip`.

# ADR-013: Accounts, signed offline access pass, Midtrans billing on Cloudflare + Neon

**Status:** Accepted — billing part superseded by ADR-015 (Midtrans removed 2026-11-20)
**Date:** 2026-11-19
**Feature:** accounts-billing
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
The POS becomes a paid product: 14-day trial, then a subscription paid through Midtrans. KasirKu must stay offline-first: a seller with no signal must keep selling. The user chose Cloudflare Pages, Neon, Resend and R2; Supabase (previously planned for owner login) is dropped.

## Decision
- **One Cloudflare Pages project.** Vite multi-page build: `/` landing (static HTML), `/app/` the PWA (router basename `/app`, PWA scope `/app/`). API in Pages Functions under `/api/*`.
- **Server code is framework-free** in `server/` (handlers take a `Deps` object: repo, mailer, midtrans, signer, clock). `functions/api/[[path]].ts` only wires Cloudflare env → Deps. Tests use an in-memory repo.
- **Neon** via `@neondatabase/serverless` HTTP driver. Tables: `accounts`, `login_codes`, `refresh_tokens`, `payments`. Entitlement lives on `accounts` (`trial_ends_at`, `paid_until`).
- **Sign-in:** 6-digit email code (hashed, 10 min, 5 attempts, 60 s resend limit) sent with Resend; optional Google ID token verified against Google JWKS (`jose`).
- **Access pass:** ES256 JWT signed with a private key held as a Cloudflare secret; the public JWK ships in the app (`VITE_PASS_PUBLIC_JWK`). The device decides `active/grace/expired` locally. Refresh tokens are random 32 bytes, stored as SHA-256, rotated on each use.
- **Billing:** Midtrans Snap redirect (no snap.js). Notification verified by signature + amount match; extension is idempotent per `order_id`.
- **Read-only on expiry** is enforced in the order services, not only the UI.
- **Billing switch:** `VITE_BILLING=off` builds the app without the gate (local dev, e2e of older flows, self-hosting).

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Online check on every app open | Simple, no keys | Breaks offline selling — the core promise | Rejected |
| HMAC-signed pass | Simpler crypto | The secret would have to ship in the app → anyone can forge passes | Rejected |
| Supabase Auth | Ready-made auth | User chose Neon + Cloudflare; second vendor for one table | Rejected by user stack |
| Snap.js popup | Inline UX | Extra third-party script in the PWA, CSP surface | Redirect is enough |
| Lock the whole app on expiry | Stronger push to pay | Holds the merchant's own data hostage | Read-only instead |

## Consequences
### Positive
- Selling keeps working offline for paid and trial users; up to 3 days past the end if the device could not confirm.
- Server code is testable without Cloudflare or Neon.
### Negative
- A determined user can keep a device offline and roll the clock back within the grace window; accepted (small money, small window).
- Losing the signing key = all devices must re-sign in after rotation.
### Risks
- Midtrans notification missed → payment shown pending. Mitigation: `GET /api/billing/status/:orderId` asks Midtrans directly when the app returns from Snap.
- Email delivery (Resend domain not verified) → nobody can sign in. Mitigation: runbook step to verify the domain before launch.

## Dependencies
- Supersedes the Supabase owner-login plan in status.md. Cloud backup to R2 and multi-device sync will reuse these accounts.

# Review — admin console revamp (v0.17, ADR-020) — 2026-11-21

**QA: PASS.** 210 unit/integration tests; typecheck; i18n:check; build. `e2e/v17.py` passes on tablet and phone against `wrangler pages dev` (sign-in incl. wrong password, landing content + FAQ as text, register-opening campaign shown once, offline-first sale, daily totals posted, merchant summary, record payment, payments month, executive report, sign out). Regression `v16.py` + `flow.py` pass on the static build. Details: `decisions/qa/admin-console-revamp.md`.

Fixed during review: sign-out button without accessible name on phones; report tiles truncated on phones; console sections now landmarks; duplicate error codes split.

**Security: PASS.** Password in a Cloudflare secret, hashed constant-time compare, hashed session tokens with 12 h expiry, IP + global lockout. No route exposes merchant menus, receipts, customers or staff. Daily totals: own-token auth, strict validation and limits, totals only, disclosed to merchants. Landing text rendered with textContent. CSV formula injection blocked. Added a strict CSP to `/admin/*`. Details: `decisions/security/admin-console-revamp.md`.

Open risks: anyone can trigger the 15-minute global lockout by guessing (accepted); daily totals come from one device per day until device sync; not yet run against real Neon.

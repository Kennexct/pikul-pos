# Handoff — after v0.14 (refreshed 2026-11-20)

**Where things stand:** v0.14 is built, reviewed (`reviews/2026-11-19-v14-review.md`) and merged to `main`, but nothing is deployed. Go-live is blocked on accounts only Kenny can create: Neon, Resend domain, Midtrans sandbox keys, Cloudflare Pages project, final prices and domain.

Shipped in code: accounts (email code, optional Google), 14-day trial, offline ES256 access pass with 3-day grace, read-only on expiry, Midtrans Snap billing, app at `/app`, landing at `/`.

**To go live:** follow `docs/runbooks/deploy-cloudflare.md`.
**Open items:** rate-limit rule, CSP, disable Bayar when expired, real prices.
**Next candidates:** multi-device sync + cloud backup (reuse accounts, Neon + R2), photo upload, item-level discount, receipt as image, split payment.

**For any new thread:** read `status.md`, the relevant `decisions/<role>/_index.md`, the latest ADR (013) and `design-system/MASTER.md` before proposing changes. Interface text is Indonesian-first with English in `src/i18n/en.ts` (`npm run i18n:check`).

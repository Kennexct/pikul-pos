# Handoff — after v0.15 (2026-11-20)

**Where things stand:** v0.15 is built and reviewed (`reviews/2026-11-20-v15-review.md`) on branch `feat/v0.15-admin-console` (in `kasirku-history.bundle`); nothing is deployed. Midtrans was removed at Kenny's request (ADR-015): there is no online payment.

Shipped in code: accounts (email code, optional Google), 14-day trial, offline ES256 access pass with 3-day grace, read-only on expiry, app at `/app`, landing at `/`, owner console at `/admin/` (plans + scheduled promo pop-up banners for the landing page and/or the merchant app, optional promo price, ADR-014).

**To go live:** `docs/runbooks/deploy-cloudflare.md` (migrations 001 + 002, `ADMIN_EMAILS`), then `docs/runbooks/admin-console.md`.
**Open items:** payment provider, rate-limit rule, CSP, real prices (set in `/admin/`).
**Next candidates:** payment provider (new ADR; reuse `priceNow()`), grant-days in the console, multi-device sync + cloud backup (Neon + R2), photo upload, item-level discount, receipt as image, split payment.

**For any new thread:** read `status.md`, the relevant `decisions/<role>/_index.md`, the latest ADRs (013–015) and `design-system/MASTER.md` before proposing changes. Interface text is Indonesian-first with English in `src/i18n/en.ts` (`npm run i18n:check`).

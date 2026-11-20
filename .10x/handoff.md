# Handoff — after the Pikul rebrand (2026-11-20)

**Where things stand:** the product is now **Pikul** (formerly KasirKu, ADR-016) on branch `feat/rebrand-pikul`, stacked on `feat/v0.15-admin-console` (both in `kasirku-history.bundle` in the project folder). Nothing is deployed. Reviews: `reviews/2026-11-20-v15-review.md`, `reviews/2026-11-20-rebrand-review.md`.

**Never rename:** IndexedDB `kasirku`, localStorage `kasirku-cart|lang|active-member`, backup marker `app: "kasirku"` (data on sellers' devices).

**To go live:** `docs/runbooks/rename-cloudflare-github.md` (GitHub repo → `pikul`, Pages project `pikul`, domain, Resend), then `docs/runbooks/deploy-cloudflare.md` and `docs/runbooks/admin-console.md`.
**Open items:** payment provider, rate-limit rule, CSP, real prices (set in `/admin/`), re-shoot landing screenshots, trademark search.

**For any new thread:** read `status.md`, the relevant `decisions/<role>/_index.md`, ADRs 013–016 and `design-system/MASTER.md`. Next ADR: 017.

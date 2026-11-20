# Handoff — v0.16 register open/close, categories, variant expand (2026-11-20)

**Latest:** v0.16 delivered on `feat/register-categories` (stacked on `feat/ui-polish` → `feat/rebrand-pikul` → `feat/v0.15-admin-console`). Register must be opened (counted float) before the first sale; count by note/coin at open and close; Kategori tab; variant expand. ADR-017, review `reviews/2026-11-20-v16-review.md`, runbook `docs/runbooks/cash-profit-backup.md` (v0.16 section).

**e2e note:** since v0.16 every older flow calls `open_register(page)` after the first-time journey.

**Never rename:** IndexedDB `kasirku`, localStorage `kasirku-cart|lang|active-member`, backup marker `app: "kasirku"`.

**To go live:** `docs/runbooks/rename-cloudflare-github.md`, then `deploy-cloudflare.md` and `admin-console.md`.
**For any new thread:** read `status.md`, the relevant `decisions/<role>/_index.md`, ADRs 013–017 and `design-system/MASTER.md`. Next ADR: 018.

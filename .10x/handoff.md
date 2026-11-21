# Handoff — admin console revamp (2026-11-21)

**Now:** spec approved by Kenny ("confirm … build it"). Strategy done (`decisions/cto|product-manager/admin-console-revamp.md`). Design done: ADR-020 (supersedes ADR-019), `decisions/architect|staff-engineer/admin-console-revamp.md`. Plan: `decisions/engineering-manager/admin-console-revamp.md` (A1…C3). SDE starts at A1. Next ADR: 021.

# Handoff — remove mock data (2026-11-21)

**Latest:** `feat/admin-no-signin` (on top of `feat/register-categories` incl. remove-mock-data): `/admin/` opens without email sign-in (ADR-019). Static host = preview mode (browser only); Pages Functions with `ADMIN_OPEN=1` = real saves, open to anyone with the link. Revert before launch.

**Previous:** `feat/remove-mock-data` (on top of `feat/register-categories`): a new store starts with an empty menu, no example discounts (ADR-018). Existing devices drop untouched, unsold example items once on start. e2e flows that need a menu call `skip_with_sample_menu(page)` / `add_sample_menu(page, 'kopi')` from `e2e/sample_menu.py` (the "Lewati, pakai contoh toko" button is gone; it is now "Lewati").

# Previous — v0.16 register open/close, categories, variant expand (2026-11-20)

**Latest:** v0.16 delivered on `feat/register-categories` (stacked on `feat/ui-polish` → `feat/rebrand-pikul` → `feat/v0.15-admin-console`). Register must be opened (counted float) before the first sale; count by note/coin at open and close; Kategori tab; variant expand. ADR-017, review `reviews/2026-11-20-v16-review.md`, runbook `docs/runbooks/cash-profit-backup.md` (v0.16 section).

**e2e note:** since v0.16 every older flow calls `open_register(page)` after the first-time journey.

**Never rename:** IndexedDB `kasirku`, localStorage `kasirku-cart|lang|active-member`, backup marker `app: "kasirku"`.

**To go live:** `docs/runbooks/rename-cloudflare-github.md`, then `deploy-cloudflare.md` and `admin-console.md`.
**For any new thread:** read `status.md`, the relevant `decisions/<role>/_index.md`, ADRs 013–019 and `design-system/MASTER.md`. Next ADR: 020.

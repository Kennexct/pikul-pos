# Handoff — admin click-to-edit delivered (2026-11-23)

**Latest:** built and verified on `claude/project-thread-6ibfvj` (ADR-024, review PASS). e2e: `v17.py` now has `no_open_fields` + `edit_plans`; local run needs `PASS_PRIVATE_JWK` from `scripts/gen-pass-key.mjs` in the server env. UI only, no API/DB change. Landing: Tabs sub-sections, read-only rows, one open row, Selesai changes draft, sticky Simpan publishes. Plans: read-only cards, Sheet editor with preview, constrained fields. Next ADR: 025.

# Handoff — Vercel + Neon launch delivered (2026-11-21)

**Latest:** v0.18.0 on `feat/vercel-neon-launch` (ADR-022, ADR-023). Hosting is Vercel: `npm run build:vercel` writes `.vercel/output` (static + one Node 22 function from `server/vercel.ts` + routes). Merchants sign up with owner, store, WhatsApp, city, email, password; sign in with email + password; admin sees the details under Merchant (list, sheet, search, CSV) and can make a one-time temporary password. Email (Resend) optional: only for "Lupa kata sandi". No preview/example data anywhere. DB setup: `db/neon-setup.sql` (regenerate with `node scripts/db-setup.mjs` after a new migration). e2e for accounts: `e2e/v18.py` against `scripts/vercel-local.mjs` (see e2e/README.md). Go-live: `docs/runbooks/deploy-vercel-neon.md`. Next ADR: 024.

# Handoff — admin sidebar nav delivered (2026-11-21)

**Latest:** `feat/admin-sidebar-nav` on top of `feat/admin-console-revamp`. /admin/ menu is a left sidebar (Bisnis: Ringkasan, Merchant, Pembayaran, Laporan; Situs & promosi: Paket harga, Kampanye, Konten landing) on ≥768 px and a left drawer behind "Buka menu" on a phone (ADR-021). e2e helper `tab()` in `v17.py` opens the drawer when needed. Next ADR: 022.

# Handoff — admin console revamp delivered (2026-11-21)

**Latest:** v0.17.0 on `feat/admin-console-revamp` (ADR-020, supersedes ADR-019). `/admin/` = password sign-in (`ADMIN_PASSWORD`), tabs Ringkasan, Merchant (summary only, record/cancel payment, trial days), Pembayaran (CSV), Laporan (executive report, CSV), Paket harga, Kampanye (+ register-opening placement), Konten landing. The app sends daily totals in the background (never on the sell path) with a one-time notice. Migration `db/migrations/003_admin_revamp.sql`. Review PASS; runbook `docs/runbooks/admin-console.md`; e2e `e2e/v17.py` needs wrangler + `ADMIN_PASSWORD` (args: base, out, log, password). Next ADR: 021. Next feature candidate: merchant back-office after device sync.

# Previous — admin console revamp planning (2026-11-21)

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

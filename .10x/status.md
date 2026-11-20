# Status

**Phase:** Delivery docs complete — v0.14 (accounts, trial, Midtrans billing). Not deployed.
**Branch:** `main` contains everything through v0.14 (`df4d12c`). Feature branches `feat/*` are merged history.
**Repo:** GitHub `Kennexct/kasirku` (per deploy runbook). Project folder copy: `kasirku-full/` + `kasirku-history.bundle`.
**Last refreshed:** 2026-11-20 (context check against the project folder)

## Current snapshot (2026-11-20)
- App version 0.14.0. 160 unit/integration tests (per v0.14 review), 13 Playwright scripts in `e2e/`.
- Stack: React 19 + Vite 8 PWA, Tailwind v4, Zustand, Dexie · Cloudflare Pages + Functions, Neon, Resend, Midtrans Snap (ADR-013). Supabase/Vercel plan superseded.
- Every PRD module M1–M14 shipped on device; M15 part 1 (staff PIN) shipped; owner login replaced by v0.14 accounts.

### Waiting on Kenny (blocks go-live)
- [ ] Neon project (Singapore) + run `db/migrations/001_accounts_billing.sql`
- [ ] Resend account + verified sending domain
- [ ] Midtrans sandbox server key (then production after KYC)
- [ ] Cloudflare Pages project connected to the GitHub repo + variables from `.env.example`
- [ ] Final prices (Rp49.000 / Rp490.000 are placeholders) and custom domain

### Open engineering items
- [ ] Cloudflare WAF rate-limit rule on `/api/auth/code` (5 / 10 min / IP)
- [ ] CSP header in `public/_headers`
- [ ] Disable "Bayar" when the pass is expired (today it rejects at payment)
- [ ] Decide the fate of the legacy Supabase outbox push (`src/services/supabase.ts`, `sync.ts`) before multi-device sync
- [ ] Next features: multi-device sync, cloud backup to R2, photo upload, item-level discount, receipt as image, split payment

---
## History (earlier status, kept for reference)

**Phase (as of v0.13):** Delivery Complete — v0.13 (variants, add-on rename)
**Branch (then):** `feat/v0.12-flex-price-weight` (stacked: … → v0.8-feedback → v0.9 → v0.10 → v0.11 → v0.12)
**Previous:** Delivery Complete (`reports-export`) — ready to merge after 2 manual device checks

| Feature | Phase | Notes |
| --- | --- | --- |
| pos-core | Delivered (v0.2–v0.3) | [DISCOVERED] |
| sales-history-refunds | Delivered (v0.4) | [DISCOVERED] |
| reports-export | **Delivered (v0.5)** | QA PASS · Security PASS · ADR-001, ADR-002 |
| staff-pin (M15 part 1) | **Delivered (v0.6)** on `feat/staff-pin` | 71 unit · 5 e2e · ADR-003, ADR-004 |
| customers (M7) | **Delivered (v0.7)** on `feat/customers` | 80 unit · 6 e2e · ADR-005 |
| v0.8 custom methods/modes · sold-out · unpaid customers | **Delivered (v0.8)** on `feat/v0.8-feedback` | 85 unit · 7 e2e · ADR-006 · review PASS |
| v0.9 cost & profit · expenses · close of day · backup | **Delivered (v0.9)** on `feat/v0.9-profit-closing-backup` | 112 unit · 8 e2e · ADR-007, ADR-008 · review PASS |
| v0.10 first-time journey · help centre | **Delivered (v0.10)** on `feat/v0.10-onboarding-help` | 123 unit · 9 e2e · ADR-009 · review PASS |
| v0.13 variants · add-on rename | **Delivered (v0.13)** on `feat/v0.13-variants-addons` | 145 unit · 12 e2e · ADR-012 · review PASS |
| v0.12 flexible price · sell by weight | **Delivered (v0.12)** on `feat/v0.12-flex-price-weight` | 140 unit · 11 e2e · ADR-011 · review PASS |
| v0.11 English | **Delivered (v0.11)** on `feat/v0.11-english` | 129 unit · 10 e2e · ADR-010 · review PASS |

## v0.9 tasks
- [x] T1 Types, Dexie v4, sync tables, migration
- [x] T2 Cost price on product + cost snapshot on sold item; `lib/profit.ts` + tests
- [x] T3 Expenses service; `lib/cashDrawer.ts`; day closing service + tests
- [x] T4 Kas screen (today, expenses, closing history)
- [x] T5 Profit card in Reports + export summary rows
- [x] T6 Backup file + restore + Settings tab + tests
- [x] T7 e2e `v09.py` + regressions, review, runbook

## reports-export tasks
- [x] T1 Refund businessDate + migrations
- [x] T2 buildReport + tests
- [x] T3 History summary alignment
- [x] T4 Extract DateRangeControl + StatTile
- [x] T5 Export CSV/XLSX/PDF + tests
- [x] T6 Reports page
- [x] T7 e2e + screenshots + bundle check

## Open before GA
- [ ] Manual: Android Chrome share sheet → WhatsApp with .xlsx
- [ ] Manual: iPad Safari (installed PWA) download
- [ ] Manual: PBKDF2 timing and PIN pad on a low-end Android phone
- [ ] Manual: backup download + restore (file picker, reload) on Android Chrome and iPad Safari; backup size with many product photos
- [x] ~~Apply DB migrations to a live Supabase project~~ superseded by ADR-013 (Neon). Original note: (checked 2026-11-18: the account has no KasirKu project; two unrelated projects exist and must not be touched)

## M15 decomposition
| Sub-project | Needs backend | Closes |
| --- | --- | --- |
| `staff-pin` — **done** — staff list, cashier PIN switch, owner PIN approval | No | client-side-only owner guard; PIN approval for void/refund/discount |
| `owner-login` — owner account (Supabase Auth), store linked to account | Yes (new Supabase project) | auto sign-in as owner |
| `sync-pull` — pull to other devices, device registration, photo upload | Yes, after `owner-login` | device-only reports |

## Remaining PRD modules
- M15 part 2 `owner-login`, part 3 `sync-pull` (need a Supabase project — user decision)
- Smaller gaps: item-level discount (M6), share receipt as image (M9), split payment (open question in PRD)

## Feedback round — APPROVED 2026-11-19 (see specs/2026-11-19-feedback-round-roadmap.md)
| Slug | What | Size |
| --- | --- | --- |
| `custom-methods-modes` | Add / rename / reorder / delete payment methods and sales modes in Settings | small–medium |
| `i18n-english` | Indonesian + English UI, typed dictionary, per-device language | large (≈ 500 strings, 70 screens/components) |
| `onboarding` (user request) | First-launch journey: language, store name + business template, payment/QRIS setup, short explanation, "Langkah awal" checklist. Absorbs recommended "setup wizard" | medium |
| `help-center` (user request) | Help button → in-app, offline help topics + contextual "?" on complex screens + replay intro | medium (≈ 12–15 short articles × 2 languages) |
| recommended additions | 1 close-of-day + expenses, 2 cost price → profit, 3 backup file, 5 sold-out toggle, 6 customer debt view | each small–medium; user to choose |

- Landing page v1 published (Design artifact UZ6XxLt43pE2gACongRVHs); source copy in landing/index.dc.html. Pro price Rp49.000 is a placeholder.

## v0.14 accounts-billing — Design Complete (2026-11-19)
Spec `specs/2026-11-19-accounts-trial-billing-design.md`, ADR-013. Stack: Cloudflare Pages + Functions, Neon, Resend, R2 (later), GitHub.

## v0.14 accounts-billing — Delivery docs complete (2026-11-19)
Built and verified (see reviews/2026-11-19-v14-review.md). Waiting on the user for: Neon project, Resend domain, Midtrans sandbox keys, Cloudflare Pages project, final prices, custom domain.

# Status

**Phase:** Delivery docs complete — rebrand KasirKu → **Pikul** (ADR-016) on top of v0.15 admin console. Not deployed.
**Branch:** `feat/rebrand-pikul` (on top of `feat/v0.15-admin-console`, on top of `main` `aaac4dc`). Delivered as a git bundle in the project folder; GitHub repo not reachable from the build session.
**Repo:** GitHub `Kennexct/kasirku` (per deploy runbook). Project folder copy: `kasirku-full/` + `kasirku-history.bundle`.
**Last refreshed:** 2026-11-20 (v0.15)

## Current snapshot (2026-11-20)
- App version 0.15.0. 165 unit/integration tests, 14 Playwright scripts in `e2e/` (new: `v15.py`).
- Stack: React 19 + Vite 8 PWA, Tailwind v4, Zustand, Dexie · Cloudflare Pages + Functions, Neon, Resend (ADR-013). No payment provider (ADR-015). Supabase/Vercel plan superseded.
- `/admin/` owner console (ADR-014): plans in Neon drive the landing page and the app; campaigns = scheduled pop-up banners (upload, optional link, on/off, landing and/or app once per account, optional promo price). Access: `ADMIN_EMAILS` + 12-hour session; `admin_audit` log.

### Waiting on Kenny (blocks go-live)
- [ ] Rename GitHub repo to `Kennexct/pikul`, create the Cloudflare Pages project as `pikul` (docs/runbooks/rename-cloudflare-github.md)
- [ ] Trademark search "Pikul" (PDKI classes 9, 42) and buy the domain
- [ ] Neon project (Singapore) + run `db/migrations/001_accounts_billing.sql` and `002_admin_console.sql`
- [ ] Resend account + verified sending domain
- [ ] Cloudflare Pages project connected to the GitHub repo + variables from `.env.example` (incl. `ADMIN_EMAILS`)
- [ ] Final prices (set them in `/admin/` after deploy) and custom domain
- [ ] Choose a payment provider (or keep extending accounts by hand in Neon)

## v0.16 register open/close, categories, variant expand — In progress (2026-11-20)
Branch `feat/register-categories` on top of `feat/ui-polish`. Spec `specs/2026-11-20-register-categories-design.md`, ADR-017.
- [x] Spec, ADR-017, PM/architect/staff/EM/senior decisions
- [ ] T1 lib/register + lib/denominations · T2 openRegister audit · T3 CashCounter + OpenRegisterSheet + Kas · T4 POS gate · T5 categories · T6 variant expand · T7 i18n, e2e v16, checks, runbook

## UI polish — Delivered (2026-11-20)
Branch `feat/ui-polish` on top of `feat/rebrand-pikul`. Pop-up open/close motion + swipe-to-dismiss + focus handling, page transitions, tap feedback, scroll-edge cues, plain monogram tiles, landing fixes. Review `reviews/2026-11-20-ui-polish-review.md`; motion table in `design-system/MASTER.md`.

### Open engineering items
- [ ] Re-shoot remaining landing screenshots (`bon.png`, `timbang.png`, `tutup-kasir.png`; `pos.png` and `varian.png` done 2026-11-20)
- [ ] Cloudflare WAF rate-limit rule on `/api/auth/code` (5 / 10 min / IP)
- [ ] CSP header in `public/_headers`
- [ ] Expired banner says "Perpanjang" but there is no online payment (ADR-015)
- [ ] Optional: "grant days" for an account in the admin console
- [ ] Decide the fate of the legacy Supabase outbox push (`src/services/supabase.ts`, `sync.ts`) before multi-device sync
- [ ] Next features: multi-device sync, cloud backup to R2 (could also host campaign banners), photo upload, item-level discount, receipt as image, split payment

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

## v0.15 admin console — Delivery docs complete (2026-11-20)
Spec `specs/2026-11-20-admin-console-design.md`, ADR-014, ADR-015 (Midtrans removed), review `reviews/2026-11-20-v15-review.md`, runbook `docs/runbooks/admin-console.md`.

## Rebrand to Pikul — Delivery docs complete (2026-11-20)
Spec `specs/2026-11-20-rebrand-pikul-design.md`, ADR-016, review `reviews/2026-11-20-rebrand-review.md`, runbook `docs/runbooks/rename-cloudflare-github.md`. Device identifiers `kasirku` are frozen.

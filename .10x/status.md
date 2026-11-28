# Status

## Send receipts by WhatsApp and email (v0.21.0) — In review (2026-11-28)
Branch `claude/project-thread-2wvt9b` from `main` `4046e80`. Kenny: send the receipt as an image by WhatsApp and email, with a web preview link, WhatsApp straight to the customer's number. Brainstorm → Kenny chose "Direct chat + link, image share extra" → "Do it". ADR-028, spec `specs/2026-11-28-send-receipts-design.md`. Next ADR: 029.
- [x] WhatsApp opens `wa.me/<customer>` with a short message + `/r/<token>` link (offline: full text + link; no account: full text as before)
- [x] `/r/<token>` web receipt (escaped, noindex, og:image = receipt PNG, "Unduh gambar", "Dibatalkan"/"Dikembalikan" banner), 90-day expiry
- [x] Receipt PNG drawn on the device (`lib/receiptImage.ts`); "Bagikan gambar" (share sheet) / "Simpan gambar" (download)
- [x] Email via Resend: `"<toko> via Pikul"`, reply-to owner, PNG attached + link, queued offline, 100/store/day; customer `email` field
- [x] Upload after each sync and each share, never on the sell path; void/refund re-uploads
- [x] Migration `007_receipt_shares.sql` (in `neon-setup.sql`), runbook updated: run before deploy
- [x] Checks: typecheck, i18n, 311 tests, build:vercel; e2e v25 (new), v19, customers, flow pass on phone + tablet (history.py fails at the same step on main, unchanged)
- [ ] Kenny: run migration 007 on Neon, set RESEND_API_KEY + MAIL_FROM for Email, try the preview, merge

## Polish pass: stop looking AI-generated (v0.20.2) — In review (2026-11-26)
Branch `claude/project-thread-3shxpg` from `main` `9ccb30d`. Kenny: "unslop, polish, clean up the entire system". Audit found light slop only, so a polish pass; palette, layout, features unchanged. No ADR. Next ADR: 028.
- [x] Uppercase tracked labels → sentence case (section titles, sub-menu titles, table headers, admin sidebar, landing)
- [x] Weights capped at 600 (was 700–800); logo wordmark unchanged
- [x] Signature: dashed `receiptRule` above money totals (cart, Pembayaran, Kas)
- [x] Landing: no full stops on headlines, plan tags no longer pills, h1 tracking eased; default receipt footer without "!"
- [x] Loading screen no longer pulses; MASTER.md updated
- [x] Checks: typecheck, i18n, 290 tests, build; e2e flow + v16 pass on phone + tablet
- [ ] Kenny: try the preview, merge

## Recognisable devices (v0.20.1) — In review (2026-11-25)
Branch `claude/project-thread-mgy8pd` from `main` `15fe414`, merged with the shift branch (v0.20.0, PR #15). Kenny: "Perangkat 1, 2" says nothing; incognito sign-ins leave devices nobody can continue. Spec `specs/2026-11-25-device-names-design.md`. No ADR (extends ADR-025). Next ADR: 028.
- [x] Devices named by browser + system ("Chrome · Android"), rename still possible; duplicates get " 2"
- [x] "Perangkat ini" listed first; "Aktif 5 menit lalu"; pull refreshes last active (throttled 1/min)
- [x] "Tidak aktif N hari" from 7 days; remove another device (inline confirm, `POST /api/sync/devices/remove`)
- [x] Private-window warning on sign-in and app, "Jendela penyamaran" badge on that device
- [x] Migration `006_device_names.sql` (in `neon-setup.sql`), runbook updated: run before deploy
- [x] Checks: typecheck, i18n, 283 tests, build:vercel; e2e v23 (new), v19, v18, v21, v16, v22, flow pass on phone + tablet
- [ ] Kenny: run migration 006 on Neon, try the Vercel preview, merge

## A new shift after closing the register (v0.20.0) — In review (2026-11-25)
Branch `claude/project-thread-kaitud` from `main` `15fe414`. Kenny: closing and then selling again the same day should open a NEW register, never continue the closed one. ADR-027, spec `specs/2026-11-25-open-shift-after-closing.md`. Next ADR: 028.
- [x] `DayClosing.shiftNo` (absent = 1); `lib/shifts.ts` holds the pure rules (current shift, time window, sale time)
- [x] Opening the register after a closing opens the next shift; opening cash prefilled from the last count, editable
- [x] Cashier banner "Shift 1 ditutup 14.05 · Buka shift baru"; the old "Tetap jual" warning is gone
- [x] Drawer maths per shift (records between the previous closing and this one; a saved order counts when paid)
- [x] "Buka kembali" only corrects the last closing, and only before the next shift starts
- [x] Kas: "Kas laci · Shift N", "Semua shift hari ini" card (per shift + day total), history names the shift, WhatsApp summary "· Shift N"
- [x] Checks: typecheck, i18n, 278 tests, build; e2e v24 (new), v16, v09, flow, manage, staff, v13, v22 pass on phone + tablet
- [ ] Kenny: try on the Vercel preview, merge

## Search reaches variants, Transaksi order Riwayat · Kas · Pesanan (v0.19.6) — In review (2026-11-25)
Branch `claude/project-thread-ani30l` from `main` `a320bba`. Kenny: the search on Kasir and Produk should also find variants; Transaksi sub-menu order History, Cash, Orders. No ADR (UI only, offline Dexie data). Next ADR: 027.
- [x] `lib/productSearch.ts`: every typed word must appear in the product name or "product + one variant" name; case and accents ignored
- [x] Kasir grid, sold-out sheet and Produk list use it; tile shows "Varian: Latte", Produk list opens and marks the matching variant
- [x] Placeholders "Cari menu atau varian…" / "Cari produk atau varian…"
- [x] Transaksi sub-menu Riwayat · Kas · Pesanan; tapping Transaksi now opens Riwayat first
- [x] Checks: typecheck, i18n, 271 tests, build; e2e v22 (new), v16, v13, flow, v08 pass on phone + tablet (history.py already fails on main, unchanged)
- [ ] Kenny: try on the Vercel preview, merge

## Admin shows the latest shop profile (v0.19.5) — In review (2026-11-23)
Branch `claude/project-thread-m0f9ao` from `main` `f874b2e`. Kenny: after a merchant edits Pengaturan > Toko & Struk, the console still showed the sign-up details. Cause: the console read only `accounts` (sign-up form); the edited store row lives in `sync_records` (tbl `stores`). No DB change, no ADR. Next ADR: 027.
- [x] `SyncRepo.storeProfiles()` (Neon: `account_store` join `sync_records` on the bound store) feeds `loadAll` in `server/merchants.ts`
- [x] Name and address from the app win; the app phone wins only when it is an Indonesian mobile (else the sign-up WhatsApp stays, so wa.me works); city stays from sign-up
- [x] Merchant sheet section "Data pendaftaran" → "Profil toko" with a new "Alamat" row; search and CSV include the address
- [x] Checks: typecheck, i18n, 266 tests, build; e2e v21 (new) and v18 pass, phone + tablet
- [ ] Kenny: try on the Vercel preview, merge

## Round 5: consistent field sizes in Settings (v0.19.4) — In review (2026-11-23)
Branch `claude/project-thread-5a5zxj` from `main` `49f04a9`. Kenny: field widths differ between Settings pages; two-column cards leave uneven gaps. No ADR (UI only). Next ADR: 027.
- [x] Settings is one column of full-width cards again (no card masonry)
- [x] `fieldGrid` (styles.ts): inside a card every field is one equal cell, two per row from @xl/card; used in Profil toko, Struk, Pajak, PIN pemilik, Tambah kasir, Aturan kasir, payment reference label, mode markup, Ganti kata sandi
- [x] Removed ad-hoc widths (max-w-sm, max-w-[12rem], max-w-[180px], max-w-[160px], sm:grid-cols-3, 150px PIN column)
- [x] Checks: typecheck, i18n, 264 tests, build; e2e v12, flow, manage, staff, v08, v13, v16, v09, v11 pass
- [ ] Kenny: try on the Vercel preview, merge

## Round 4 polish: number fields, unit buttons, weigh-out callout, trial days, desktop width (v0.19.3) — Delivered, merged as PR #10 (2026-11-23)
Branch `claude/project-thread-5a5zxj` from `main` `6ddf96e`. Kenny's round-4 feedback. No ADR (UI only). Next ADR: 027.
- [x] `NumberInput` (%, days, counts): 0 is a grey placeholder, focus selects; used for tax, service, markup, cashier rules, add-on max. `RupiahInput` blanks a 0 when its placeholder is "0"
- [x] "Dijual per" unit buttons: 3 columns, name + short hint on two lines
- [x] Sell by amount: "Timbang sebanyak 0,543 kg" in a large brand callout
- [x] English trial/subscription text was missing the day count (`{0|day|days}` without `{0}`); i18n test now guards it
- [x] Settings on wide screens: section cards in two columns (replaced in v0.19.4 by one column + fieldGrid)
- [x] Checks: typecheck, i18n, 264 tests, build; e2e v12, flow, manage, staff, v08, v13, v16, v09, v11 pass
- [ ] Kenny: try on the Vercel preview, merge

## Round 3 polish: sold-out red, Uang pas, foldable sub-menu, receipt prefix (v0.19.2) — Delivered, merged as PR #9 (2026-11-23)
Branch `claude/project-thread-5a5zxj` from `main` `0949d83`. Kenny's round-3 feedback. No ADR (UI + one optional Store field `receiptPrefix`, absent = "INV"). Next ADR: 027.
- [x] Sold-out button on the cashier and "Habis" badges in red; sold-out switches use `Switch tone="danger"`
- [x] "Uang pas" quick-cash button highlighted (brand border/fill + Banknote icon)
- [x] Tablet sub-menu (Transaksi, Kelola, Pengaturan) folds to an icon strip (`SidePanel`, remembered per device in localStorage `kk.subnav.collapsed`)
- [x] "Jual per berat atau ukuran" moved to Pengaturan → Mode Penjualan (saves straight away)
- [x] Toko & Struk → "Awalan nomor struk" (A–Z/0–9, max 6) used by new receipt numbers `<PREFIX>-YYYYMMDD-<dev><seq>`
- [x] Checks: typecheck, i18n, 261 tests, build; e2e v12, flow, manage, staff, v13, v16, v09, v11, v08 pass
- [ ] Kenny: try on the Vercel preview, merge

## Product form: category + price fixes, quicker redesign (v0.19.1) — In review (2026-11-23)
Branch `claude/project-thread-5a5zxj` on `main` `b73980a`. Kenny: new category typed in "Produk baru" was lost on save; base price "0" turned 10.000 into 100.000; make adding products and variants feel quick. No ADR (UI only, no data change). Next ADR: 027.
- [x] Fix: a category typed but not added is created (or matched by name) on save; Enter adds it
- [x] Fix: RupiahInput selects its amount on focus; base and variant price show empty instead of 0
- [x] Redesign: tablet tile preview, phone photo beside the name, "Satu harga / Ada varian", variant rows with quick fill + Enter-to-next, per-variant extras under Detail, "Pengaturan lain" fold, "Simpan & tambah lagi"
- [x] Checks: typecheck, i18n, 259 tests, build; e2e v20 (new), v12, v13, manage, v09 phone/tablet
- [ ] Kenny: try on the Vercel preview, merge
- [x] Main menu (Kenny, round 2): Kasir · Transaksi (Pesanan, Riwayat, Kas) · Kelola (Produk, Pelanggan) · Laporan · Pengaturan; sub-menu = left list on tablet, tabs on phone; phone bar 4 + Akun (Pengaturan, Bantuan); 20px icons; tables use @container/page. e2e staff, v11, v16, v09, flow, customers pass. history.py fails on main too (Void button, pre-existing)
- [x] Settings (Kenny): sections as a left list on tablet; save bar only when something changed (with Batal); fixed save bar staying "dirty" after saving (updatedAt)

## Device sync (v0.19) — Delivered, merged to main (2026-11-23)
Branch `claude/project-thread-zzc5ov` on top of `main` `f376b98`. Spec `specs/2026-11-21-device-sync-design.md`, ADR-025 (sync protocol, store binding), ADR-026 (register per device). Kenny chose: everything both ways, ask which store to keep, register per device; "build it". Next ADR: 027.
- [x] Spec, ADRs, strategy/design/plan decisions
- [x] S1 migration 005 · [x] S2 server sync API
- [x] C1 device id · [x] C2 sync engine · [x] C3 binding on boot · [x] C4 cash per device · [x] C5 Settings → Sinkronisasi · [x] C6 i18n, e2e, runbook
- [x] Review `reviews/2026-11-21-device-sync-review.md` PASS · runbook `docs/runbooks/deploy-vercel-neon.md` → Device sync
- [x] Kenny ran 005 on Neon; merged with main (admin click-to-edit). ADRs renumbered 025/026 because main took ADR-024.
## Admin click-to-edit: Konten landing + Paket harga (v0.18.1) — Delivered (2026-11-23)
Branch `claude/project-thread-6ibfvj` on `main` `f376b98`. Spec `specs/2026-11-23-admin-click-to-edit-design.md`, ADR-024. Kenny: forms closed by default, landing sub-sections + preview on the right; chose "one Simpan for all". Next ADR: 025.
- [x] Spec, ADR-024, PM/architect/staff/EM/senior decisions
- [x] T1 editing.ts + tests · [x] T2 LandingPreview · [x] T3 ContentRows + ContentPanel · [x] T4 PlanCard/PlanSheet/PlansPanel · [x] T5 i18n, e2e v17, checks, screenshots
- [x] QA + security PASS (`reviews/2026-11-23-admin-click-to-edit-review.md`)
- [ ] Kenny: review on the branch / merge; ships with the next deploy (no migration)

## Vercel + Neon launch, merchant sign-up (v0.18) — Delivered (2026-11-21)
Branch `feat/vercel-neon-launch` on top of `main` `cbd5680`. Spec `specs/2026-11-21-vercel-neon-launch-design.md`, ADR-022 (Vercel Build Output API + Neon, preview mode removed), ADR-023 (email + password sign-up with profile; Kenny chose it). Review `reviews/2026-11-21-vercel-neon-launch-review.md` PASS. Runbook `docs/runbooks/deploy-vercel-neon.md`. Next ADR: 024.
- [x] Example data: admin preview mode + example merchants deleted; no seed accounts in SQL (only the 2 starting plans)
- [x] Vercel: `npm run build:vercel` → `.vercel/output`; `vercel.json`; local check `scripts/vercel-local.mjs`
- [x] Sign-up (owner, store, WhatsApp, city, email, password), sign-in, forgot password (email code if Resend, else admin temp password), change password
- [x] Admin Merchant: sign-up details in list, sheet, search, CSV; temporary password
- [x] DB: `004_merchant_signup.sql`, `db/neon-setup.sql` (001–004, idempotent)
- [x] Checks: typecheck, i18n, 229 tests, build, Vercel build; e2e v18 + v17 phone/tablet on Vercel output; flow, v10, v16
- [ ] Kenny: Neon project + run `db/neon-setup.sql`; Vercel env vars; deploy; smoke test (runbook steps 1–5)
- [ ] Later: delete Cloudflare adapter files once Vercel is live; Vercel Firewall rule on `/api/auth/*`

## Admin sidebar navigation (v0.17.1) — Delivered (2026-11-21)
Branch `feat/admin-sidebar-nav` on top of `feat/admin-console-revamp`. Review `reviews/2026-11-21-admin-sidebar-nav-review.md` PASS. Spec `specs/2026-11-21-admin-sidebar-nav-design.md`, ADR-021. Kenny: "create the menu show at left navbar". Phone: drawer (Kenny chose). Next ADR: 022.
- [x] Spec, ADR-021, PM/architect/staff/EM decisions
- [x] Kenny approved ("build it")
- [x] T1 nav + Sidebar · [x] T2 NavDrawer · [x] T3 AdminApp layout · [x] T4 e2e v17 + checks

## Admin console revamp (v0.17) — Delivered (2026-11-21)
Branch `feat/admin-console-revamp` on top of `feat/admin-no-signin`. Spec `specs/2026-11-21-admin-console-revamp-design.md`, ADR-020, review `reviews/2026-11-21-admin-console-revamp-review.md` (QA + security PASS), runbook `docs/runbooks/admin-console.md`. Kenny chose: business console first (merchant back-office after sync), admin password sign-in, email only, daily totals always on. Next ADR: 021.
- [x] A1 migration 003, repo split · [x] A2 admin password sign-in · [x] A3 ledger + merchant handlers · [x] A4 console Ringkasan/Merchant/Pembayaran
- [x] B1 app daily totals + notice · [x] B2 daily endpoint · [x] B3 analytics · [x] B4 console Laporan + CSV
- [x] C1 landing content · [x] C2 Konten landing tab · [x] C3 register pop-up placement
- [x] QA + security (CSP on /admin added), runbook, e2e `v17.py` phone + tablet, bundle
- [ ] Kenny: run migration 003 on Neon, set `ADMIN_PASSWORD`, remove `ADMIN_EMAILS`/`ADMIN_OPEN`, deploy
- [ ] Later: merchant back-office (after device sync)

**Phase:** Delivery complete — admin console without sign-in, temporary (ADR-019) on top of remove mock data (ADR-018) on top of v0.16 register open/close, Kategori tab, variant expand (ADR-017) on top of UI polish → rebrand → v0.15. Not deployed.
**Branch:** `feat/rebrand-pikul` (on top of `feat/v0.15-admin-console`, on top of `main` `aaac4dc`). Delivered as a git bundle in the project folder; GitHub repo not reachable from the build session.
**Repo:** GitHub `Kennexct/kasirku` (per deploy runbook). Project folder copy: `kasirku-full/` + `kasirku-history.bundle`.
**Last refreshed:** 2026-11-20 (v0.16)

## Current snapshot (2026-11-20)
- App version 0.16.0. 173 unit/integration tests, 15 Playwright scripts in `e2e/` (new: `v16.py`).
- Stack: React 19 + Vite 8 PWA, Tailwind v4, Zustand, Dexie · Cloudflare Pages + Functions, Neon, Resend (ADR-013). No payment provider (ADR-015). Supabase/Vercel plan superseded.
- `/admin/` owner console (ADR-014): plans in Neon drive the landing page and the app; campaigns = scheduled pop-up banners (upload, optional link, on/off, landing and/or app once per account, optional promo price). Access: sign-in removed for now (ADR-019): preview mode on a static host, real saves need `ADMIN_OPEN=1` on Pages Functions (anyone with the link can edit). Restore `ADMIN_EMAILS` + 12-hour session before launch; `admin_audit` log.

### Waiting on Kenny (blocks go-live)
- [ ] Rename GitHub repo to `Kennexct/pikul`, create the Cloudflare Pages project as `pikul` (docs/runbooks/rename-cloudflare-github.md)
- [ ] Trademark search "Pikul" (PDKI classes 9, 42) and buy the domain
- [ ] Neon project (Singapore) + run `db/migrations/001_accounts_billing.sql`, `002_admin_console.sql`, `003_admin_revamp.sql`
- [ ] Resend account + verified sending domain
- [ ] Cloudflare Pages project connected to the GitHub repo + variables from `.env.example` (incl. `ADMIN_PASSWORD`)
- [ ] Final prices (set them in `/admin/` after deploy) and custom domain
- [ ] Choose a payment provider (or keep extending accounts by hand in Neon)

## Remove mock data — Delivered (2026-11-21)
Branch `feat/remove-mock-data` on top of `feat/register-categories`. ADR-018. Kenny: "remove all the mockup data".
- [x] New store starts empty: no example menu, categories, add-ons or discounts (`services/storeSetup.ts`); template picker removed from the journey; "Lewati" = empty store
- [x] Empty states: cashier "Menu masih kosong" + "Tambah produk"; Langkah awal item "Tambah menu"
- [x] One-time cleanup on existing devices (`services/legacySampleMenu.ts`): soft-deletes untouched, unsold seed rows; audit `sample_menu_removed`
- [x] Example menus kept for tests only (`src/test/sampleMenu.ts`, `e2e/fixtures/sample-menus.json`, `e2e/sample_menu.py`); not in the bundle (checked `dist/`)
- [x] Checks: typecheck, i18n:check, 170 tests, build; e2e flow, manage, staff, customers, v08–v13, v16, reports pass on phone + tablet. `history.py` fails at the Void step on the base branch too (pre-existing, not from this change). v14/v15 need wrangler, not run.
- [ ] Manual: update an old device that has the example menu and confirm only untouched items disappear

## v0.16 register open/close, categories, variant expand — Delivered (2026-11-20)
Branch `feat/register-categories` on top of `feat/ui-polish`. Spec `specs/2026-11-20-register-categories-design.md`, ADR-017, review `reviews/2026-11-20-v16-review.md` (QA + security PASS).
- [x] Spec, ADR-017, all role decisions
- [x] T1 lib/register · T2 opening audit · T3 OpenRegisterSheet + Kas · T4 POS gate · T5 categories · T6 variant expand · T7 i18n, help, e2e v16, checks, runbook
- [x] Revision: count-by-denomination removed (Kenny)
- [ ] Manual: gate on a low-end Android phone and iPad Safari

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

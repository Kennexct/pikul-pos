# Pikul — Project Infrastructure

> Formerly **KasirKu** (renamed 2026-11-20, ADR-016). A few device-side identifiers keep the old name on purpose: see "Legacy identifiers" in `design-system/MASTER.md`.

Offline-first, web-based POS for Indonesian UMKM and street food sellers. Built mobile and tablet first, installable as a PWA.
This repo implements the infrastructure for the PRD *"KasirKu (now Pikul) — PRD: Simple POS for UMKM & Street Food Sellers"* (module refs M1–M15).

## 1. Architecture

```
┌──────────────────────── Device (phone / tablet browser, PWA at /app/) ───────────────┐
│  React UI (pages/)  ──►  Zustand (store/)  ──►  lib/ (pricing, money, dates)          │
│        │                                                                              │
│        ▼                                                                              │
│  Dexie / IndexedDB (db/localDb.ts)  ◄── POS reads & writes ONLY here (works offline)   │
│        │  saveAndQueue(): record + outbox row in ONE transaction                       │
│        ▼                                                                              │
│  Outbox (push target not live yet — legacy Supabase client, off without env)           │
│  Access pass: ES256 JWT checked on device → active / grace (3 days) / expired=read-only│
│  Service worker (Workbox): app shell + product photos + QRIS image cached              │
└───────────────────────────────────────────┬──────────────────────────────────────────┘
                                            │ HTTPS
┌───────────────────────────────────────────▼──────────────────────────────────────────┐
│  Cloudflare Pages: / landing (static) · /app/ PWA · /api/* Pages Functions             │
│   functions/api/[[path]].ts wires env → server/ (framework-free handlers, Deps object) │
│   • Neon Postgres (ap-southeast-1): accounts, login codes, tokens, plans, campaigns     │
│   • Resend: 6-digit email sign-in code · optional Google ID token                      │
│   • /admin/ owner console: plans + scheduled promo pop-ups (ADR-014)                   │
│   • R2: reserved for cloud backup (not used yet)                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
Before v0.14 the plan was Supabase + Vercel; ADR-013 replaced it. supabase/migrations is kept as the
reference schema for future multi-device sync and is not applied anywhere.
```

### Why this stack

| Decision | Choice | Reason |
| --- | --- | --- |
| App type | PWA (React + Vite) | No Play Store friction, installs from a link, one codebase for phone/tablet/desktop |
| Local data | Dexie (IndexedDB) | Offline checkout is a hard requirement; indexed queries for history and reports |
| State | Zustand | Small, no boilerplate; cart persisted to localStorage to survive reloads |
| Styling | Tailwind CSS v4 | Fast responsive layouts, tiny CSS output |
| Backend | Cloudflare Pages Functions + Neon Postgres (ADR-013) | Serverless, free tiers, Singapore region; server code is framework-free and tested with an in-memory repo |
| Auth & access | Email code (Resend) + offline ES256 access pass | Selling keeps working offline through trial, paid period and a 3-day grace. No payment provider is connected (ADR-015) |
| Hosting | Cloudflare Pages | Landing at `/`, app at `/app/`, API at `/api/*` in one project |
| IDs | Client UUIDv7 | Create records offline without collisions; time-sortable |
| Money | Integer Rupiah | No floating-point errors; IDR has no minor unit in practice |

## 2. Folder structure

```
pikul/                           # GitHub repo: Kennexct/kasirku (rename: docs/runbooks/rename-cloudflare-github.md)
├── .github/workflows/ci.yml     # typecheck → test → build on every PR
├── public/icons/                # PWA icons from the Pikul brand kit v1
├── supabase/migrations/         # reference sync schema (RLS, triggers, views) — not applied anywhere
├── db/migrations/               # Neon schema: accounts (v0.14), plans + campaigns (v0.15)
├── server/                      # framework-free API handlers: auth, subscription overview, admin, catalog, pass, repos
├── functions/api/[[path]].ts    # Cloudflare Pages Functions entry → server/
├── landing/                     # landing page source (built to / by scripts/landing/build.py)
├── app/index.html               # PWA entry served at /app/
├── admin/index.html             # owner console served at /admin/ (src/admin/, ADR-014)
├── docs/runbooks/               # how-to per feature, incl. deploy-cloudflare.md
├── e2e/                         # Playwright browser flows (Python)
├── src/
│   ├── types/index.ts           # ALL domain types (single source of truth)
│   ├── constants/index.ts       # limits, defaults, routes — no magic numbers
│   ├── lib/                     # pure logic, unit-tested
│   │   ├── pricing.ts           # mode price, variants, discounts, tax/service, change
│   │   ├── money.ts             # Rp format/parse
│   │   ├── businessDate.ts      # day cut-off, receipt numbers
│   │   └── id.ts                # UUIDv7
│   ├── db/localDb.ts            # Dexie schema (offline store + outbox)
│   ├── services/
│   │   ├── supabase.ts          # client (null when env missing → pure offline dev)
│   │   └── sync.ts              # saveAndQueue + pushOutbox
│   ├── store/                   # Zustand: useCartStore, useSessionStore
│   ├── hooks/useOnlineStatus.ts # connectivity + background sync loop
│   ├── components/Layout/       # AppShell (bottom bar phone / side rail tablet), SyncBadge
│   └── pages/                   # one folder per module (POS, More, … placeholders mapped to PRD)
├── vite.config.ts               # React, Tailwind, PWA manifest + Workbox caching, Vitest
└── public/_headers, _redirects # Cloudflare headers + /app/* SPA fallback
```

Page folders to add as modules are built: `OpenOrders/`, `History/`, `Reports/`, `Products/`, `Customers/`, `Settings/`, `Auth/`.

## 3. Getting started

```bash
npm install
cp .env.example .env.local     # optional: app runs fully offline without it
npm run dev                    # http://localhost:5173 — open DevTools device mode (iPad / Pixel)
npm test                       # pricing, business date, receipt no., UUIDv7
npm run build                  # typecheck + production build + service worker
```

Accounts and the admin console: follow [`docs/runbooks/deploy-cloudflare.md`](docs/runbooks/deploy-cloudflare.md) — Neon (`db/migrations/001_accounts_billing.sql`, `002_admin_console.sql`), access-pass key (`node scripts/gen-pass-key.mjs`), Resend, Cloudflare Pages, `ADMIN_EMAILS`. Using the console: [`docs/runbooks/admin-console.md`](docs/runbooks/admin-console.md). Locally, `npm run build && npm run pages:dev` with `DEV_MODE=1` uses an in-memory DB and prints sign-in codes to the log. `VITE_BILLING=off` builds the app without the account gate.

## 4. Offline sync design

1. Every write goes through `saveAndQueue(table, record)`: the record and an outbox row are written in one IndexedDB transaction.
2. `pushOutbox()` runs every 15 s and on reconnect; it upserts by client UUID, so retries never duplicate.
3. Transactions (orders, refunds) are append-only → no conflicts. Catalog/settings edits use last-write-wins on `updated_at`.
4. Receipt numbers carry a 2-char device code (`INV-20261118-A10042`) so two offline devices never collide.
5. After 10 failed attempts the cashier sees "Sinkronisasi tertunda" — data stays safe on device.
6. **Next (phase 1):** pull changes since `last_pulled_at` per table into Dexie for multi-device.

## 5. Security model

- **v0.14 accounts:** sign-in codes hashed (10 min, 5 attempts, 60 s resend); refresh tokens stored as SHA-256 and rotated; the access-pass private key is a Cloudflare secret, only the public JWK ships. **v0.15 admin:** allow-listed emails (`ADMIN_EMAILS`) with a session issued in the last 12 hours; every change goes to `admin_audit`; campaign links only `/…` or `https://`; banners only PNG/JPEG/WebP checked by magic bytes. Open before launch: rate-limit rule on `/api/auth/code`, CSP header.
- The points below describe the planned sync backend (`supabase/migrations`), not yet live.
- Only the public anon key ships to the client; every table has RLS keyed on `store_id` (`is_store_member`, `is_store_owner`).
- Catalog/config tables: owner writes, members read. Operational tables: members insert/update, **no delete policy**.
- `orders_immutability` trigger blocks edits to items/totals/payments once an order is no longer `open`.
- PINs stored as PBKDF2-SHA-256 hashes (WebCrypto, ADR-003); void/refund/discount overrides record the approving owner and write `audit_events`.
- **Known limitation:** PIN checks run on the device. They stop misuse at the counter and make it auditable, but not someone with developer-tools access to the device. Server-side enforcement comes with owner login (M15 part 2).

## 6. Environments and delivery

| Env | Where | Backend | Deploy trigger |
| --- | --- | --- | --- |
| Local | `npm run dev` / `npm run pages:dev` | none, or `DEV_MODE=1` in-memory API | — |
| Preview | Cloudflare Pages preview URL | Neon branch | every PR (once the Pages project exists) |
| Production | Cloudflare Pages + custom domain | Neon (Singapore) | merge to `main` |

CI (`.github/workflows/ci.yml`): `npm ci` → `typecheck` → `i18n:check` → `test` → `build`. The Cloudflare Pages project, Neon project and Resend domain do not exist yet (see `.10x/status.md`).

## 7. Current status (v0.15 — + admin console; online payment removed)

Design rules, tokens and component inventory: [`design-system/MASTER.md`](design-system/MASTER.md). Browser flow checks: [`e2e/`](e2e/README.md).


| PRD module | Status | Where |
| --- | --- | --- |
| M1 POS checkout | Done: grid, search, categories, cart, qty, line notes, change calculator | `pages/POS/` |
| M2 Products & variants | Done: CRUD, categories, variant groups (single/multi, required, +Rp), per-mode price | `pages/Products/` |
| M3 Product photo | Done on device: compressed to WebP ≤ 200 KB. Cloud upload pending (R2, with cloud backup) | `lib/image.ts` |
| M4 Sales mode | Done: add / rename / reorder / delete own modes (max 8); switch re-prices the cart; base / per-product / markup % rules; default mode | `pages/Settings/SalesModeSettings.tsx` |
| M5 Payment + QRIS | Done: add / rename / reorder / delete own methods (max 12, ADR-006); methods on/off, reference off/optional/required, static QRIS upload + full-screen display. Single method per order (split = v1.1) | `PaymentSheet.tsx`, `QrisDisplay.tsx` |
| M6 Discount | Order-level done (presets + ad-hoc % / Rp, cashier limit). Item-level pending | `DiscountSheet.tsx` |
| M8 Open orders | Done: save with label, nav badge, resume (same receipt no.), cancel with reason + audit | `pages/OpenOrders/` |
| M9 Receipt | Done: preview, browser print (58/80 mm), WhatsApp text share. Share-as-image pending | `components/Receipt/` |
| M14 Settings | Store profile, receipt text, tax/service, auto-receipt, staff & PIN, cashier rules | `pages/Settings/` |
| M10 Sales history | Done: Hari ini / Kemarin / 7 hari / Bulan ini / custom range (≤ 366 days), filters (status, payment, mode), search by receipt no. or label, period summary, list grouped by day (table on tablet), detail with reprint + WhatsApp | `pages/History/` |
| M11 Void & refund | Done: void (whole sale, same business day, no prior refund), refund (per item qty, within refund window, proportional discount/service/tax, last refund absorbs rounding), reason codes, permission rules, atomic write of refund + status + audit event. Cashier "PIN pemilik" approval arrives with M15 | `services/refunds.ts`, `lib/refunds.ts` |
| M12 Reports | Done: KPIs, sales by hour/day, payment method / sales mode / cashier breakdowns, top products; refunds counted on refund day (ADR-002); owner only; lazy route | `pages/Reports/`, `lib/reports.ts` |
| M13 Export | Done: Excel (5 sheets, numeric Rupiah), PDF summary, CSV (Transaksi/Item/Refund); on-device (ADR-001), share or download, formula-injection guard | `lib/export/` |
| M15 part 1 — Staff & PINs | Done: owner PIN + recovery code, cashiers (add / reset PIN / deactivate), switch seller, owner gate on Reports/Products/Settings with 5-minute auto-lock, one-time owner-PIN approval for void / refund / over-limit discount (approver recorded + audit), lockout, rules UI. On-device only (ADR-003, ADR-004) | `services/staff.ts`, `components/Pin/`, `pages/Settings/staff/` |
| M7 Customers | Done: list + search (name / phone), add / edit / delete (delete erases phone + note), pick or quick-add from the cart, name on receipt / history / exports, WhatsApp receipt straight to the customer, visits / spend / last visit (ADR-005) | `pages/Customers/`, `services/customers.ts` |
| Sold-out switch (v0.8) | Done: any seller marks a menu item "Habis" from the cashier; tile stays visible but cannot be sold | `pages/POS/components/SoldOutSheet.tsx` |
| Unpaid customers (v0.8) | Done: "Belum bayar" tab — who owes, how much, since when; WhatsApp reminder; derived from saved orders, no ledger (ADR-006) | `pages/Customers/DebtList.tsx`, `lib/customers.ts` |
| Cost price & profit (v0.9) | Done: optional "Harga modal" per product, cost snapshot on each sold item, profit statement in Reports + Excel/PDF (cost mode or simple mode, ADR-007) | `lib/profit.ts`, `pages/Reports/ProfitCard.tsx` |
| Expenses (v0.9) | Done: record by category, from the drawer or not; owner deletes; in reports and exports | `pages/Cash/`, `services/expenses.ts` |
| Close of day (v0.9) | Done: "Tutup kasir" — expected vs counted cash, difference, WhatsApp summary, sold-out reset, reopen (owner), history | `lib/cashDrawer.ts`, `services/dayClosing.ts` |
| Backup file (v0.9) | Done: save all device data to one file; replace-all restore with validation (ADR-008) | `lib/backup.ts`, `services/backup.ts`, `pages/Settings/BackupSettings.tsx` |
| First-time journey (v0.10) | Done: store name + business template (5), payment choices, how-it-works cards; "Langkah awal" checklist derived from data (ADR-009) | `pages/Onboarding/`, `services/seedTemplate.ts`, `lib/checklist.ts` |
| Help centre (v0.10) | Done: 15 offline topics with search, contextual "?" on each page, intro replay | `content/help*.ts`, `pages/Help/`, `components/Help/` |
| English (v0.11) | Done: Indonesian + English for every screen, receipt, WhatsApp text, export and help topic; per-device language with reload on change; typed source-string dictionary (ADR-010) | `src/i18n/`, `content/help.en.ts`, `scripts/i18n-*.mjs` |
| Flexible price (v0.12) | Done: per-product switch; the seller types the price at the register; the normal price is stored next to the charged price and shown in history and the Item export (ADR-011) | `pages/POS/components/SaleEntrySheet.tsx`, `lib/quantity.ts` |
| Sell by weight / measure (v0.12) | Done: store setting; products sold per kg, ons, gram, litre or metre; weight or money amount typed at the register; decimal quantity, whole-Rupiah line totals; receipts, refunds, profit and exports aware of units | `lib/quantity.ts`, `lib/pricing.ts`, `pages/Products/ProductForm.tsx`, `pages/Settings/StoreSettings.tsx` |
| Variants & add-ons (v0.13) | Done: product → variant (own full price, takeaway price, cost, sold-out) → add-ons (ice, sugar, size…; previously called "Varian"); cashier sheet variant-then-add-on; reports per variant (ADR-012) | `lib/productVariants.ts`, `pages/POS/components/OptionSheet.tsx`, `pages/Products/ProductVariantsEditor.tsx` |
| Accounts, trial & billing (v0.14) | Done in code: email-code sign-in (optional Google), 14-day trial, offline ES256 access pass with 3-day grace, read-only on expiry, landing at `/`, app at `/app/` (ADR-013). Online payment removed for now (ADR-015). Not deployed yet | `server/`, `functions/api/`, `src/lib/accessPass.ts`, `pages/Auth/`, `pages/Settings/SubscriptionSettings.tsx` |
| Admin console (v0.15) | Done: owner-only `/admin/` — plans (name, price, days, features, on sale) feed the landing page and the app; scheduled pop-up banners with upload, optional link, on/off, landing and/or merchant app (once per account), optional promo price (ADR-014) | `server/admin.ts`, `server/catalog.ts`, `src/admin/`, `src/landing/live.ts`, `src/components/Access/CampaignPopup.tsx` |
| Online payment | Removed (Midtrans, ADR-015); entitlement can be granted by hand in Neon until a provider is chosen | — |
| Multi-device sync, cloud backup | Not started — will reuse v0.14 accounts (Neon, R2) | — |

First run opens a three-step journey; the chosen template (`services/seedTemplate.ts`) seeds a small editable menu so the seller can sell immediately.

Tests: 165 unit/integration tests (incl. server auth, admin and campaigns against an in-memory repo) (incl. a 20k-order performance guard) (`npm test`) cover pricing, variants, receipt numbering, business date, WhatsApp receipt text, and the order service against an in-memory IndexedDB (paid, open → resume → paid, cancel + audit, validation, StrictMode double-seed guard) and void/refund rules (same-day void, refund window, partial → full, permission, reason).

## 8. Build order (maps to PRD release plan)

| Phase | Weeks | Modules | Infra already in place |
| --- | --- | --- | --- |
| Foundation | 1–2 | M15 auth, onboarding, sync pull | Dexie schema, outbox push, RLS, PWA shell |
| Sell | 3–5 | M1, M2, M3, M4, M5, M6, M9 | `lib/pricing.ts` (tested), cart store, storage buckets, print CSS |
| Operate | 6–7 | M7, M8, M10, M11 | `orders.status`, refunds table, audit events, immutability trigger |
| Understand | 8–9 | M12, M13, M14 | `daily_sales` and `order_lines` views; add `exceljs` + `jspdf` for export |
| Harden | 10 | Soak test, perf, security | CI pipeline, bundle budget (POS currently 125 KB gzip of 250 KB) |

## 9. Adding or changing interface text

Write the Indonesian sentence in code as `t('Kalimat {0}', value)` and add the same key with its English to `src/i18n/en.ts` — the type-checker refuses a `t()` call without an English entry. `npm run i18n:check` reports missing and unused entries (also in CI); `npm run i18n:scan` lists literals that still look like untranslated interface text. Long help text lives in `src/content/help.id.ts` and `help.en.ts`.

## 10. Team process

This repo uses the 10x-Team workflow: decisions, ADRs, specs and reviews live in [`.10x/`](.10x/status.md). Runbooks live in `docs/runbooks/`.

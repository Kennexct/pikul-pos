# Admin console revamp: run Pikul as a business (v0.17) — 2026-11-21

**Feature slug:** `admin-console-revamp` · **ADR:** 020 · **Builds on:** ADR-013, 014, 015, 019 (019 is reverted by this work)

## Ask (Kenny, 2026-11-21)
"Revamp my admin console, make it useful for my POS business." Then his list:
1. One admin console to manage landing page content, pricing, FAQ, and pop-up campaigns on the landing page and on the merchant's first register access of the day (banner, clickable only if it has a link).
2. Record merchant subscription payments.
3. Merchant list: current plan, transaction types, total transaction value and count per merchant.
4. Executive report summary.
5. No access to a merchant's account: only each merchant's executive summary and the all-merchant total.
6. Merchant plan list.
7. Use the console as "my POS business data analyst", fully functional.

## Decisions taken in the brainstorm
| Question | Kenny's choice |
| --- | --- |
| Direction | Business console now; a merchant back-office (owner sees own store remotely) later, after multi-device sync |
| Admin sign-in | One admin password in a Cloudflare secret (`ADMIN_PASSWORD`); `ADMIN_OPEN` removed |
| Merchant identity in the console | Email only (no store name, no phone) |
| Merchant consent to sending daily totals | Always on, part of the terms; no switch |

## Releases (one branch `feat/admin-console-revamp`, three tested steps)
- **A — Sign-in, Merchant, Pembayaran, plan list.** Works with data the server already has.
- **B — Daily sales totals from the app, merchant summary, Laporan eksekutif.** Needs an app update.
- **C — Konten landing (hero, features, FAQ) and the daily register pop-up.**

## Console layout
`/admin/` keeps its own entry (not in the POS PWA). Tabs, phone and tablet first:
**Ringkasan · Merchant · Pembayaran · Laporan · Paket harga · Kampanye · Konten landing**.
On a phone the tab bar scrolls sideways. Each tab is its own file under `src/admin/`.

## A. Sign-in
- `POST /api/admin/login {password}`. The server compares SHA-256(password) to SHA-256(`ADMIN_PASSWORD`) in constant time. Not set or shorter than 12 characters = console closed (`admin_disabled`).
- Lockout: 5 wrong tries within 15 minutes (counted per IP **and** globally at 20) locks login for 15 minutes (`admin_login_attempts`).
- Success = random 32-byte token; its SHA-256 lives in `admin_sessions` with a 12-hour expiry. The console keeps the token in `sessionStorage`. "Keluar" deletes the session.
- Every admin endpoint requires `Authorization: Bearer <admin token>`. Merchant refresh tokens are no longer accepted for admin (removes the `ADMIN_EMAILS` path).
- Audit actor = `admin` plus the first 8 characters of the session id.
- **Preview mode stays:** when `/api/admin/*` does not exist (static host), the console opens with example data (clearly labelled "Contoh") so the screens can be seen. Nothing saves to a server in preview.

## A. Merchant tab
List of accounts, newest first, 50 per page, search by email, filter chips:
- **Coba** (trial, not expired) · **Berbayar** (paid, not expired) · **Hampir habis** (ends within 3 days) · **Kedaluwarsa** (ended) · **Tidak aktif** (not seen for 7+ days).

Row: email, sign-up date, status chip, plan name (last recorded payment's plan, or "Masa coba"), active until, last active, total paid. Release B adds: transactions and value in the last 30 days.

Merchant detail (sheet on phone, side panel on tablet), read-only executive view:
- Account: email, signed up, status, active until, last active, total paid.
- Actions: **Catat pembayaran**, **Tambah hari coba** (1–60 days, reason required).
- Payment history for this account.
- Release B: executive summary for a chosen range (default 30 days): transactions, gross, refunds, net, average ticket, voids; by payment type; by sales mode; daily trend; busiest hours.
- Never shown: receipts, items, customers, staff, menu. There is no "log in as merchant".

**Paket merchant (plan list):** at the top of the Merchant tab, one count per plan: Masa coba, each paid plan, Kedaluwarsa. Tapping a count filters the list.

## A. Pembayaran
**Catat pembayaran** form: merchant (preselected from detail, or search by email), plan (fills amount with today's price incl. live promo, and days; both editable), method (`transfer`, `qris`, `ewallet`, `cash`, `other`), reference (optional, ≤ 80 chars), paid on (date, default today, not in the future, not before sign-up), note (optional).
- Effect: `paid_until = max(now, trial_ends_at, paid_until) + days`. The payment stores the start and end it produced.
- The app sees the new date on its next online pass refresh (no app change needed).

**Pembayaran tab:** month picker, total received (non-cancelled), count, list (date, email, plan, amount, method, reference, recorded at), CSV download.

**Batalkan** a payment: reason required. The row stays, marked cancelled. If it is the account's latest non-cancelled payment, `paid_until` returns to the value before it; otherwise the days are subtracted (never earlier than the trial end). Shown with a warning in the confirm sheet.

**Tambah hari coba:** moves `trial_ends_at` forward from `max(now, trial_ends_at)`; recorded in `account_grants` and the audit log.

## A. Ringkasan (home)
Cards: paying merchants, on trial, expired, new sign-ups (7 / 30 days), money received this month and last month, trial-to-paid rate (accounts older than 14 days that ever paid ÷ accounts older than 14 days).
**Perlu dihubungi:** trials ending within 3 days, paid accounts ending within 7 days, accounts expired in the last 7 days. Each row: email (tap to copy, `mailto:` link), what is ending, when.
Release B adds: all-merchant transactions and value today / 7 days, and "Berhenti memakai" (paid or trial accounts with no sales in 7 days).

## B. Daily totals from the app
**What is sent:** one row per store per business date, totals only:
`{businessDate, transactions, gross, discounts, refunds, net, voidCount, voidAmount, itemsSold, byPaymentType: {cash, qris, transfer, ewallet, other} each {transactions, gross, refunds}, bySalesMode: [{name, transactions, gross, refunds}] (≤ 12), byHour: [24 × {transactions, gross}], appVersion}`.
Never sent: order lines, product names, customer names, staff, receipts, notes.

**How:**
- Computed with the existing `buildReport` for one business date (same numbers as the merchant's own Laporan).
- `POST /api/merchant/daily` with the merchant's refresh token (Bearer). Body = up to 35 rows. Server upserts by `(account_id, business_date)`; a newer `computedAt` wins.
- When: ~5 s after the app opens online, after each "Tutup kasir", and every 30 minutes while open and online. Each send covers the last 7 business dates; the first send after the update covers the last 35.
- Fully in the background: no spinner, no error shown, never on the sell path, never blocks. Offline = nothing happens; it catches up next time.
- Expired (read-only) accounts still send.
- Disclosure: a one-time info sheet after the update ("Pikul menerima ringkasan total penjualan harian…", "Mengerti"), the same sentence in Bantuan and in the landing page terms/FAQ. No switch (Kenny's decision).

**Validation (server):** date format, within the last 400 days and not after tomorrow, integers ≥ 0 and ≤ 10^12, arrays bounded, body ≤ 64 KB, ≤ 35 rows, ≤ 120 requests per account per hour.

## B. Laporan (executive report, the analyst view)
Date range: today, 7 days, 30 days, this month, last month, custom (≤ 366 days). Two sections:

**Bisnis Pikul:** sign-ups per week, active merchants (sent a sale in range), paying merchants, money received per month, trial-to-paid rate, churned (paid ended and not renewed in range).

**Semua merchant:** total transactions, gross, net, average ticket, refunds; mix by payment type (bar); daily trend (line); busiest hours (bar); busiest weekdays; top 10 merchants by net (email, transactions, net, share); merchants grouped by daily average transactions (0, 1–10, 11–50, 51+).

CSV download of the per-merchant table for the range. All numbers computed on the server from `merchant_daily`; the console only draws them (existing chart components).

## C. Konten landing
Editable: hero headline (≤ 80), hero subtitle (≤ 200), feature cards (title ≤ 40, text ≤ 160, up to 8, reorder, hide), FAQ (question ≤ 120, answer ≤ 600, up to 20, reorder, hide), footer contact line (≤ 120).
- Stored as one versioned row (`site_content`, JSON). Saving publishes; `GET /api/public/landing` returns it with the plans and pop-up (edge-cached 60 s).
- The landing page's current static text is the fallback and the initial content.
- Text only (no HTML); the landing script sets `textContent`. Line breaks allowed in answers.
- "Kembalikan ke teks bawaan" restores the built-in copy.

## C. Daily register pop-up
New campaign placement **"Saat buka kasir pertama hari itu"** (`show_on_register`), beside landing and app.
- Shown in the app right after the merchant opens the register for the first time on a business day, if a register campaign is live and the app fetched it while online earlier (cached in localStorage with its end time).
- At most once per business day per device. The existing "app" placement (once per account) stays.
- The banner is clickable only when it has a link (unchanged rule); closing it never blocks selling.

## Data (migration `003_admin_revamp.sql`)
- `accounts.last_seen_at timestamptz` — set on code verify, Google sign-in and pass refresh (at most once per 10 minutes per account).
- `payments(id uuid pk, account_id fk, plan_id text null, amount int, days int, method text, reference text, paid_on date, note text, starts_at, ends_at, prev_paid_until, recorded_at, recorded_by, cancelled_at null, cancel_reason null)`; index `(account_id, paid_on)`, `(paid_on)`.
- `account_grants(id, account_id, days, reason, prev_trial_ends_at, new_trial_ends_at, at, by)`.
- `admin_sessions(token_hash pk, created_at, expires_at)`; `admin_login_attempts(key text, at timestamptz)` with index on `(key, at)`.
- `merchant_daily(account_id fk, business_date date, transactions, gross, discounts, refunds, net, void_count, void_amount, items_sold, by_payment jsonb, by_mode jsonb, by_hour jsonb, app_version, computed_at, received_at, pk (account_id, business_date))`; index `(business_date)`.
- `campaigns.show_on_register boolean not null default false`.
- `site_content(id int pk check (id = 1), content jsonb, updated_at)`.
Money stays integer Rupiah everywhere.

## Security and privacy
- Admin password never in the repo or the client; only its hash comparison on the server. Lockout as above. `/admin/*` stays `noindex`, `no-store`.
- Admin reads are summaries only. No endpoint returns a merchant's orders, products, customers or staff, because the server never receives them.
- The daily endpoint only writes rows for the account behind the token; it cannot read anything back.
- Every admin write (payment, cancel, grant, plan, campaign, content) goes to `admin_audit`.
- Merchant emails appear only behind admin sign-in; preview mode uses fake emails (`contoh…@pikul.id`).
- Terms/privacy copy updated to state the daily totals (UU PDP transparency).

## Errors and edge cases
- Payment for an account that is mid-trial: extension starts at trial end (no lost trial days).
- Two admins tabs recording at once: each payment is its own row; `paid_until` is updated with `greatest()` in one statement.
- Merchant with two devices: both send the same business date; last `computedAt` wins (same totals when the data is the same; until sync exists, the second device's sales are not merged — noted in the console as "dari satu perangkat").
- Store timezone differences: business dates are the merchant's own; totals are summed by date as reported.
- Daily send fails (offline, 5xx): ignored silently, retried on the next trigger.

## Testing
- Server unit tests: login + lockout, session expiry, payment extend/cancel maths, grant, daily upsert + validation + rate limit, report aggregation, content validation.
- Client unit tests: daily-row builder from `buildReport`, register pop-up once-per-day rule, admin API client modes.
- e2e (phone + tablet): admin login → record payment → merchant shows paid; app sends daily row after a sale (with wrangler); register pop-up after opening the register; landing shows edited FAQ.
- Checks: typecheck, i18n:check, tests, build.

## Out of scope
Merchant back-office (after sync), WhatsApp or store name in the console, online payment, bulk email, multiple admin users with roles, per-plan feature gating, item-level analytics across merchants.

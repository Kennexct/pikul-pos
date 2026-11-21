# ADR-020: Admin business console, password sign-in and daily sales totals from merchants

**Status:** Accepted
**Date:** 2026-11-21
**Feature:** admin-console-revamp
**Author:** 10x-Team (Architect + Staff Engineer + Security)
**Supersedes:** ADR-019 (admin without sign-in); the admin access part of ADR-014 (`ADMIN_EMAILS` + 12-hour merchant session)

## Context
Kenny wants the console to run Pikul as a business: merchants, manual payments, executive reports per merchant and across all merchants, landing content and FAQ, and a pop-up on the first register opening of the day (spec `specs/2026-11-21-admin-console-revamp-design.md`). Constraints:
- The server only has accounts, plans and campaigns. Sales live on devices (offline-first, no sync yet).
- There is no payment provider (ADR-015). Resend is not live, so email-code admin sign-in cannot be used; ADR-019 left the console open to anyone with the link.
- Kenny must not be able to open a merchant's account or see receipts, only summaries. Daily totals are always on (Kenny's decision), disclosed to merchants.

## Decision
1. **Admin sign-in = one password** (`ADMIN_PASSWORD`, Cloudflare secret, ≥ 12 chars). `POST /api/admin/login` compares SHA-256 digests in constant time; lockout 5 failures / 15 min per IP and 20 / 15 min globally (`rate_events`). Success issues a random admin token (hash in `admin_sessions`, 12 h). All `/api/admin/*` require `Bearer <admin token>`. `ADMIN_EMAILS` and `ADMIN_OPEN` are removed.
2. **Manual payments are an append-only ledger** (`payments`). Recording extends `accounts.paid_until` from `max(now, trial end, paid_until)`; cancelling keeps the row and reverses its days. Extension maths is a pure function (`server/ledger.ts`); the repo writes the account and the ledger row in one statement guarded by the previous value (optimistic concurrency, `conflict` on a race). Free trial days go to `account_grants`.
3. **Merchants send daily totals, not data.** The app computes one row per business date with the existing `buildReport` (same numbers as its own Laporan) and posts the last 7 dates (35 on first run) to `POST /api/merchant/daily` with its refresh token, in the background (after open, after Tutup kasir, every 30 min online). The server upserts `merchant_daily (account_id, business_date)`; newest `computedAt` wins. Payment mix is stored as fixed columns per payment *type* (cash, qris, transfer, ewallet, other) so cross-merchant sums are plain SQL; sales modes and hours are small JSON arrays.
4. **Analytics run on the server** from `merchant_daily`, `accounts` and `payments` through a few repo aggregate queries (per date, per merchant, per mode, per hour, payments per month). Pure post-processing (rates, buckets, weekdays) lives in `server/analytics.ts`. The console only renders.
5. **Landing content** (hero, features, FAQ, contact line) is one JSON row (`site_content`), validated server-side, served with `GET /api/public/landing`, applied by `src/landing/live.ts` with `textContent`. The static page's built-in text is the default (shared file `landing/content.json`, read by the page builder and the server).
6. **Register pop-up** = new campaign placement `show_on_register`; the app caches the live register campaign from `GET /api/public/app` and shows it once per business date per device after the register is opened.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Upload every order (start of sync) and report from it | Exact, item-level analytics; first step of sync | Large privacy change, much bigger build, contradicts "Kenny cannot see merchant data" | Out of scope; sync gets its own ADR |
| Compute analytics in the console from raw rows | Simple server | Pulls all merchants × days to the browser; slow on phone | Server aggregates instead |
| Keep email-code admin sign-in (ADR-014) | Per-person identity | Needs Resend live; Kenny is blocked today | Password chosen by Kenny; can switch back later |
| Cloudflare Access in front of `/admin` | No code | Zero Trust setup on Kenny's side | Optional extra layer, documented in runbook |
| External BI (Metabase) on Neon | Rich charts | Hosting + DB credentials with emails; no payment actions | Maybe later on a read-only role |
| Payment mix stored as JSON | Flexible | Cross-merchant sums need JSON unnesting | Fixed type columns; payment types are a closed list |

## Consequences
### Positive
- Accounts can be extended without SQL; every change is audited.
- Kenny sees adoption and volume across merchants, while receipts, items and customers never leave the device.
- Landing copy and FAQ change without a deploy.
### Negative
- Totals from a merchant with two devices reflect one device per date until sync exists (shown as "dari satu perangkat").
- A shared password has no per-person audit trail (audit shows session id prefix).
- The app gains a background network call (never on the sell path).
### Risks
- Merchants could send fake totals (only to their own account) → only skews their own numbers; values bounded and rate-limited.
- Password brute force → lockout per IP and global; long password required.
- Merchant distrust → disclosure sheet, Bantuan text, landing FAQ.

## Dependencies
- Migration `003_admin_revamp.sql` after 001, 002.
- `ADMIN_PASSWORD` set in Cloudflare Pages.
- Constrains future sync: `merchant_daily` stays the analytics source until order sync exists; a later ADR may derive it server-side.

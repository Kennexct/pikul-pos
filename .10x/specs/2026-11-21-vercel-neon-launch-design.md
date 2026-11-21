# Vercel + Neon launch with merchant sign-up (v0.18) — design

**Date:** 2026-11-21 · **Feature slug:** `vercel-neon-launch` · **ADRs:** 022 (hosting), 023 (sign-up and sign-in)
**Asked by Kenny:** "clean all mockup data, prepare hosting deploy using Vercel and Neon Database, prepare admin and merchant sign in and sign up page, all the merchant sign-up data also sent to admin console, prepare the database."

## Goals
1. Production shows only real data: no example merchants, payments or reports anywhere.
2. One Vercel project serves the landing page, the PWA (`/app/`), the admin console (`/admin/`) and the API (`/api/*`), with Neon as the database.
3. Merchants can **sign up** (email, password, owner name, store name, WhatsApp, city) and **sign in** (email + password). Admin signs in with `ADMIN_PASSWORD`.
4. Every sign-up detail is visible, searchable and exported in the admin console Merchant section.
5. One SQL file sets up a fresh Neon database; a runbook walks Kenny through Neon, Vercel and the first sign-in.

## Non-goals
Payment provider, multi-device sync, cloud backup, merchant self-service profile editing beyond password change.

## 1. Remove example data
- Delete `src/admin/preview.ts` and preview mode. When `/api/admin/me` does not answer (no server), the console shows "Server admin belum tersambung" with a pointer to the runbook, never example data.
- `db/migrations/002` seeds two plans (Bulanan Rp49.000, Tahunan Rp490.000). These are the starting price list shown on the landing page, not mock data; they stay and are edited in `/admin/` → Paket harga. (Flagged in the runbook as placeholders.)
- In-memory repos stay for unit tests and local dev only (`DEV_MODE=1`); they never run on Vercel production because the adapter refuses to start without `DATABASE_URL`.
- Already done earlier: new stores start empty (ADR-018).

## 2. Vercel hosting (ADR-022)
- Build Output API v3: `npm run build:vercel` runs the normal Vite build, bundles `server/` + an adapter into one Node function, and writes `.vercel/output/` (static files, `functions/api.func`, `config.json` with routes and headers). Vercel uses that folder as-is, so there is no dependence on Vercel's own TypeScript compilation of `api/`.
- Routes: `/api/*` → the function; static files; `/app/*` → `/app/index.html` (SPA + PWA); `/admin` → `/admin/index.html`. Headers from `public/_headers` (CSP on `/admin`, `no-cache` on `sw.js` and app shell) move into `config.json`.
- Adapter `server/vercel.ts` turns Node `req/res` into the framework-free `route()` call. Client IP from `x-real-ip`. Public GETs cached at Vercel's CDN with `s-maxage=60` (no purge API: admin edits to plans/campaigns/landing appear within a minute).
- `vercel.json` pins build command, install command and output.
- Cloudflare files (`functions/`, `_headers`, `_redirects`, wrangler) stay for now so nothing breaks; they are unused on Vercel.

## 3. Sign-up and sign-in (ADR-023)
- **Sign-up page** `/app/` (tab "Daftar"): email, password (8+ characters), owner name, store name, WhatsApp number, city. Creates the account, starts the 14-day trial, signs in, and prefills the store name in the first-time setup.
- **Sign-in page** (tab "Masuk"): email + password. Wrong password 5× in 15 min per email or 20× per IP → wait. Errors in Indonesian.
- **Forgot password:** if email is configured (Resend), "Lupa kata sandi?" sends a 6-digit code and sets a new password. Without Resend, the page says to contact Pikul admin; admin creates a one-time temporary password in the Merchant sheet and sends it by WhatsApp.
- **Change password** in Settings → Langganan & akun.
- Google button stays optional; it signs in existing accounts only (sign-up needs the profile fields).
- Passwords: PBKDF2-SHA256, 210,000 iterations, 16-byte salt, via WebCrypto. Never logged or returned.
- Offline selling unchanged: the access pass (ADR-013) still decides on the device.

## 4. Admin console Merchant section
- List shows store name, owner name, email, WhatsApp, city, status, sign-up date; search matches any of them.
- Merchant sheet shows all sign-up fields, a WhatsApp link, and "Buat kata sandi sementara".
- Merchant CSV export includes the sign-up fields.

## 5. Database
- `db/migrations/004_merchant_signup.sql`: `accounts` gets `password_hash`, `owner_name`, `store_name`, `phone`, `city`; `password_changed_at`.
- `db/neon-setup.sql`: 001 → 004 in one idempotent file for a fresh Neon database (safe to re-run).
- Runbook `docs/runbooks/deploy-vercel-neon.md`: create Neon project (Singapore), run `neon-setup.sql` in the SQL Editor, generate the pass key, create the Vercel project, set env vars, deploy, first admin sign-in, first merchant sign-up, check it in the console.

## Testing
Unit tests for sign-up, password sign-in, lockout, reset, temporary password, admin profile fields and the Vercel adapter. Typecheck, i18n:check, full unit suite, build, `build:vercel`; run the bundled function locally against the in-memory repo; Playwright sign-up → admin sees merchant on phone and tablet.

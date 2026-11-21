# Runbook — deploy Pikul on Vercel + Neon (v0.18, ADR-022 / ADR-023)

One Vercel project serves everything: the landing page `/`, the cashier app `/app/` (PWA), the admin console `/admin/` and the API `/api/*`. The database is Neon Postgres. Email (Resend) is **optional**: merchants sign up and sign in with email + password.

Time needed: about 30 minutes. You need: a GitHub account with the `Kennexct/pikul-pos` repo, Node 22 on your laptop, and a browser.

---

## 1. Create the Neon database (5 min)

1. Go to <https://console.neon.tech> → sign in (GitHub sign-in is fine) → **New Project**.
   - Project name: `pikul`
   - Postgres version: the default (17)
   - Region: **AWS Asia Pacific (Singapore)** (closest to Indonesia, and the API runs in Singapore too)
   - Click **Create project**.
2. On the project dashboard click **Connect**. Keep database `neondb`, role `neondb_owner`, and copy the connection string. It looks like:
   `postgresql://neondb_owner:xxxx@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   This is your **`DATABASE_URL`**. Keep it secret (it contains the password).
3. Create the tables. Choose one:
   - **Browser:** left menu **SQL Editor** → open `db/neon-setup.sql` from the repo in a text editor → copy everything → paste → **Run**. The last result lists 13 tables: `account_grants, accounts, admin_audit, admin_sessions, campaigns, images, login_codes, merchant_daily, payments, plans, rate_events, refresh_tokens, site_content`.
   - **Terminal (Ubuntu):** `sudo apt install -y postgresql-client`, then
     `psql "postgresql://…your DATABASE_URL…" -f db/neon-setup.sql`

   The file is safe to run again; it never deletes data. It contains no example merchants. It does add the two starting price plans (Bulanan Rp49.000, Tahunan Rp490.000), which you change later in `/admin/` → Paket harga.

> Already ran migrations 001–003 on Neon earlier? Run only `db/migrations/004_merchant_signup.sql` (or the whole `neon-setup.sql`, same result).

## 2. Make the access-pass keys (2 min)

On your laptop, in the repo folder:

```bash
cd ~/pikul-pos
npm ci
node scripts/gen-pass-key.mjs
```

It prints two lines:
- `PASS_PRIVATE_JWK='{…"d":…}'` → secret, server only.
- `VITE_PASS_PUBLIC_JWK='{…}'` → public, goes into the app build.

Copy the JSON **inside** the single quotes for each (from `{` to `}`). Save both in your password manager. If you lose the private key, make a new pair and set both again; every device then signs in once more.

## 3. Choose the admin password

Pick a long passphrase, at least 12 characters (for example four random words). This is **`ADMIN_PASSWORD`**, the only way into `/admin/`.

## 4. Create the Vercel project (10 min)

1. <https://vercel.com/new> → **Import Git Repository** → pick `Kennexct/pikul-pos` (give Vercel access to the repo if asked).
2. On the configure screen:
   - **Framework Preset:** `Other` (the repo's `vercel.json` sets this).
   - **Build and Output Settings:** leave all three empty / not overridden. `vercel.json` runs `npm ci` and `npm run build:vercel`, which writes `.vercel/output` (static site + API function + routes). **Do not set Output Directory to `dist`.** If you imported the repo before as a static site, open **Settings → Build and Deployment** and switch off any Output Directory / Build Command override.
   - **Root Directory:** `./`
3. Open **Environment Variables** and add these (tick Production and Preview):

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | the Neon connection string | mark **Sensitive** |
| `PASS_PRIVATE_JWK` | private key JSON from step 2 | mark **Sensitive** |
| `VITE_PASS_PUBLIC_JWK` | public key JSON from step 2 | used at build time; without it the app builds with no sign-in |
| `ADMIN_PASSWORD` | your passphrase (12+ characters) | mark **Sensitive** |
| `APP_ORIGIN` | `https://<your-project>.vercel.app` | change to your domain later |

   Optional (leave out for now):

| Name | When |
|---|---|
| `RESEND_API_KEY`, `MAIL_FROM` | once a Resend sending domain is verified: turns on "Lupa kata sandi" by email code. `MAIL_FROM` like `Pikul <masuk@yourdomain.id>` |
| `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID` | Google sign-in button for existing accounts |

   Never set `DEV_MODE` on Vercel (the server ignores it in Production anyway).
4. **Settings → General → Node.js Version:** `22.x`.
5. Click **Deploy**. The build log should end with `Vercel output ready: .vercel/output (function … KB)`.

> Alternative for step 1: Vercel **Storage → Marketplace → Neon** creates a Neon database and adds `DATABASE_URL` to the project for you. You still run `db/neon-setup.sql` in that database's SQL Editor.

## 5. Check it works (5 min)

Replace `https://pikul.vercel.app` with your URL.

```bash
curl -s https://pikul.vercel.app/api/auth/options      # {"emailReset":false,"google":false}
curl -s https://pikul.vercel.app/api/public/landing | head -c 200   # JSON with "plans"
```

1. Open `https://…/admin/` → sign in with `ADMIN_PASSWORD`. Merchant shows "Tidak ada merchant" (no example data).
2. On your phone open `https://…/app/` → tab **Daftar** → fill owner, store, WhatsApp, city, email, password → **Daftar dan mulai 14 hari gratis**. The first-time setup opens with the store name filled in.
3. Back in `/admin/` → **Merchant**: the new store is listed with owner, email, WhatsApp, city. Open it: **Data pendaftaran** shows everything; **Unduh CSV** exports the list.
4. On another device: `/app/#masuk` → sign in with the same email and password.
5. `/admin/` → **Paket harga**: set your real prices.

## 6. Custom domain (when you have it)

Vercel → project → **Settings → Domains** → add `pikul.id` (or yours) and follow the DNS steps. Then set `APP_ORIGIN=https://pikul.id` and **Redeploy**.

## Day-to-day

- **Merchant forgot the password (no Resend):** `/admin/` → Merchant → open the store → **Buat kata sandi sementara** → **Kirim lewat WhatsApp**. Their old password and all their devices are signed out; they change it in Pengaturan → Langganan & akun → Ganti kata sandi.
- **Turn on email reset later:** verify a domain in Resend, add `RESEND_API_KEY` and `MAIL_FROM`, redeploy. "Lupa kata sandi?" then sends a 6-digit code.
- **Changing a `VITE_…` variable** needs a redeploy (it is baked into the app at build time). Server variables apply on the next request after a redeploy too.
- **Landing / plans / campaign edits** show on the public site within 60 seconds (CDN cache).
- **Cleanup (monthly, optional):** in Neon SQL Editor: `delete from rate_events where at < now() - interval '7 days';`

## When something is wrong

| What you see | Cause | Fix |
|---|---|---|
| `/admin/` says "Server API belum tersambung" | The API function was not deployed (static-only build) | Check the build log ends with "Vercel output ready"; clear any Output Directory override; redeploy |
| `/admin/` says "Konsol belum aktif" | `ADMIN_PASSWORD` missing or shorter than 12 | Set it, redeploy |
| API answers `{"error":"server_error"}` | Missing `DATABASE_URL` / `PASS_PRIVATE_JWK` / `APP_ORIGIN`, or Neon unreachable | Vercel → project → **Logs**: look for `missing_config` or `api_error` |
| App opens without any sign-in page | `VITE_PASS_PUBLIC_JWK` was not set at build time | Set it, redeploy |
| "Sesi berakhir" on every device after a deploy | `PASS_PRIVATE_JWK` changed | Expected after a key change; everyone signs in once |
| Sign-up says "relation … does not exist" in Logs | `neon-setup.sql` not run | Run step 1.3 |

**Rollback:** Vercel → **Deployments** → pick the last good one → **⋯ → Promote to Production**. Database changes in 004 only add columns, so older code keeps working.

**Selling never depends on any of this:** the cashier works offline from the device; the server is only for sign-up, sign-in, renewals of the access pass and the admin console.

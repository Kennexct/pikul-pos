# Deploy Pikul: Cloudflare Pages + Neon + Resend (v0.15, ADR-013, ADR-014, ADR-015)

No payment provider is connected (Midtrans was removed, ADR-015). Trials end after 14 days; extend an account by hand (Troubleshooting) until a provider is added.

## 1. Neon (database)
1. Create a project in the region nearest Indonesia (AWS ap-southeast-1, Singapore).
2. SQL editor → run `db/migrations/001_accounts_billing.sql`, then `db/migrations/002_admin_console.sql`.
3. Copy the pooled connection string → `DATABASE_URL`.

## 2. Access-pass key
```
node scripts/gen-pass-key.mjs
```
- `PASS_PRIVATE_JWK` → Cloudflare **encrypted** variable. Never commit it.
- `VITE_PASS_PUBLIC_JWK` → Cloudflare build variable.
- Rotating the key signs everyone out on their next refresh; their store data stays on the device.

## 3. Resend (sign-in email)
1. Add and verify your sending domain (SPF + DKIM records at your DNS).
2. API key with "Sending access" → `RESEND_API_KEY`; `MAIL_FROM` e.g. `Pikul <masuk@yourdomain>`.
Until the domain is verified, codes only reach the Resend account owner's email.

## 4. Admin console
1. Set `ADMIN_PASSWORD` (encrypted variable, at least 12 random characters) for `/admin/`. Unset or shorter = console closed. Run `db/migrations/003_admin_revamp.sql` first (see `admin-console.md`).
2. Optional extra lock: Cloudflare Zero Trust → Access → Self-hosted application on `<your-domain>/admin/*`, allow only your email.
3. How to use it: `docs/runbooks/admin-console.md`.

## 5. Cloudflare Pages
1. Workers & Pages → Create → Pages → Connect to GitHub → `Kennexct/kasirku` (or `Kennexct/pikul` once renamed). Project name: `pikul` → `pikul.pages.dev`. Renaming an existing project: `docs/runbooks/rename-cloudflare-github.md`.
2. Build command `npm run build`, output `dist`, Node 20+ (`NODE_VERSION=20`).
3. Variables: everything in `.env.example` (build + encrypted runtime). `APP_ORIGIN` = the public URL.
4. Functions in `functions/` deploy automatically; `/api/*` is served by them, `/` is the landing page, `/app/` the POS.
5. Custom domain: Pages → Custom domains. Then update `APP_ORIGIN` and the Google OAuth origin.
6. Recommended: Security → WAF → Rate limiting rule on `/api/auth/code`: 5 requests / 10 min per IP.

## 6. R2
Not used yet (campaign banners are stored in Neon, max 500 KB each). Reserved for cloud backup (planned "segera" feature).

## Local end-to-end
```
node scripts/gen-pass-key.mjs > /tmp/keys.env && source /tmp/keys.env
export VITE_PASS_PUBLIC_JWK && npx vite build
printf 'PASS_PRIVATE_JWK=%s\nAPP_ORIGIN=http://localhost:8788\nADMIN_PASSWORD=uji-konsol-pikul-2026\nDEV_MODE=1\n' "$PASS_PRIVATE_JWK" > .dev.vars
npx wrangler pages dev dist --port 8788 > /tmp/wrangler.log &
python3 e2e/v14.py http://localhost:8788 /tmp/out /tmp/wrangler.log
python3 e2e/v15.py http://localhost:8788 /tmp/out /tmp/wrangler.log   # after v14: it changes the prices
```

## Troubleshooting
| Symptom | Check |
|---|---|
| "Terjadi kesalahan di server" on sign-in | Functions log: `missing_config` → a runtime variable is missing; `resend_403` → domain not verified |
| "Konsol belum aktif" in /admin | `ADMIN_PASSWORD` missing or under 12 characters; redeploy after setting it |
| Landing still shows the old price | Public data is edge-cached for 60 s; wait a minute and reload |
| Everyone signed out after deploy | `PASS_PRIVATE_JWK` and `VITE_PASS_PUBLIC_JWK` are not a pair |
| Grant days by hand | `update accounts set paid_until = now() + interval '30 days' where email = '…';` |

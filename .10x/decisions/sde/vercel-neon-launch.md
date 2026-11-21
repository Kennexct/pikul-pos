# SDE — vercel-neon-launch (v0.18.0)
Built:
- `server/password.ts` (PBKDF2-SHA256 210k, temp passwords), `server/signup.ts` (signup, login, options, reset, change, admin temp password), routes in `router.ts`.
- `auth.ts`: `session` and `checkCode` exported; email-code verify and Google sign in existing accounts only (`no_account`); `/api/auth/code` only mails existing accounts and 404s without a mailer.
- Repo: `createAccount(a, hash)` returns boolean; `getPasswordHash`, `setPasswordHash`; profile columns mapped in neon + memory repos. `Deps.emailEnabled`.
- Admin: `preview.ts` deleted; `openConsole` → `{ gate }` with `no_server`; `MerchantProfile.tsx` (details, WhatsApp link, temp password); list/search/CSV show profile.
- App: `pages/Auth/` = SignInPage (tabs Masuk/Daftar, #masuk/#daftar), SignUpForm, ForgotPassword, PasswordInput, authErrors; `Settings/ChangePassword.tsx`; onboarding prefills the store name typed at sign-up.
- Vercel: `server/vercel.ts`, `scripts/vercel-build.mjs`, `scripts/vercel-local.mjs`, `vercel.json`, `tsconfig.vercel.json`; CI runs the Vercel build.
- DB: `db/migrations/004_merchant_signup.sql`, `db/neon-setup.sql` via `scripts/db-setup.mjs` (unit test keeps it in sync).
Deviations: none from ADR-023. Cloudflare adapter kept (now `emailEnabled` aware, no longer requires Resend).
Tech debt: Cloudflare files can be deleted once Vercel is live; e2e v14/v15 superseded (email codes); `rate_events` needs periodic cleanup.

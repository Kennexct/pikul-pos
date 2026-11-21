# Security — vercel-neon-launch
Threats and controls:
- Credential stuffing / brute force: 5 failures per email (hashed key) or 20 per IP per 15 min → `locked`; same error for unknown email and wrong password; dummy PBKDF2 on unknown email (timing).
- Password storage: PBKDF2-SHA256 210k, per-user salt, constant-time compare; hash never leaves the repo layer (asserted in tests: admin list/JSON has no `pbkdf2`).
- Sign-up abuse: 10 sign-ups per IP per hour; field validation, control characters refused; CSV export escapes formula cells.
- Enumeration: sign-up reveals "email taken" (accepted, standard UX); forgot-password replies the same for unknown emails.
- Session: password change/reset/temp password revoke all refresh tokens. Temp password shown once, audit without the secret.
- Hosting: secrets only in Vercel env; DEV_MODE ignored in production; `x-real-ip` set by Vercel; CSP + noindex on /admin; security headers on all routes; body read capped at 1.2 MB.
Residual: no CAPTCHA on sign-up; Vercel Firewall rate-limit rule on `/api/auth/*` recommended once traffic grows.

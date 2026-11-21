# Architect — vercel-neon-launch (ADR-022, ADR-023)
- Components: `server/vercel.ts` (adapter), `scripts/vercel-build.mjs` (Build Output API), `server/password.ts` (PBKDF2), `server/signup.ts` (signup/login/reset/password/temp), repo methods for profile + password.
- Data flow unchanged otherwise: app → `/api/auth/*` → session (pass + refresh) → offline pass on device.
- Failure modes: DB down → sign-up/in fail with server_error, selling unaffected; missing env → 500 `missing_config` logged.

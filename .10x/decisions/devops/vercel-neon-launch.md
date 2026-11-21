# DevOps — vercel-neon-launch
- Build: `npm run build:vercel` (vercel.json) → `.vercel/output` (Build Output API v3). Function: Node 22, region sin1, 30 s max.
- CI: typecheck, i18n, tests, build, Vercel output build.
- Env vars: DATABASE_URL, PASS_PRIVATE_JWK, VITE_PASS_PUBLIC_JWK, ADMIN_PASSWORD, APP_ORIGIN; optional RESEND_API_KEY+MAIL_FROM, GOOGLE_CLIENT_ID+VITE_GOOGLE_CLIENT_ID.
- Deploy: push to main → production; PRs → preview (same Neon DB unless a Neon branch is set for Preview).
- Rollback: Vercel "Promote" previous deployment; migrations additive.

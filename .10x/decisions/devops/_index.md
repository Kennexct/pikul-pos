# DevOps — index

[DISCOVERED] GitHub Actions CI: npm ci → typecheck → test → build. Vercel SPA rewrites + security headers. PWA via vite-plugin-pwa (Workbox).
[DISCOVERED] Git initialised this session: `main` = baseline v0.4; feature branches `feat/<slug>`.

## Features
- reports-export — deploy order, rollback → `reports-export.md`
- staff-pin — stacked branch, additive migration → `staff-pin.md`
- accounts-billing (v0.14) → `accounts-billing.md`

## Update 2026-11-20
- Hosting is Cloudflare Pages (one project: `/` landing, `/app/` PWA, `/api/*` Functions). `vercel.json` removed; headers and SPA fallback in `public/_headers` and `public/_redirects`.
- CI also runs `npm run i18n:check`. Deploy steps: `docs/runbooks/deploy-cloudflare.md`. No live environment exists yet.
- rebrand-pikul → `rebrand-pikul.md`
- register-categories (v0.16) — ADR-017 → `register-categories.md`
- admin-console-revamp.md — v0.17 business console (ADR-020)
- `admin-sidebar-nav` — admin console left sidebar (ADR-021)

- vercel-neon-launch (v0.18) — ADR-022, ADR-023 → `vercel-neon-launch.md`
- device-sync (v0.19) — ADR-024, ADR-025 → `device-sync.md`

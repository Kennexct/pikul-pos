# EM — rebrand-pikul plan

Branch `feat/rebrand-pikul` on top of `feat/v0.15-admin-console`.
1. T1 Copy: i18n keys + en.ts, help content, admin, onboarding, PDF, email, HTML titles, manifest.
2. T2 Identifiers: file names, JWT issuer, package name, env example; freeze comments on storage ids.
3. T3 Logo + icons: Logo.tsx, `--color-kunyit`, public/favicon.svg, public/icons/*, apple-touch.
4. T4 Landing: build.py logo/copy/tagline → regenerate index.html + landing/index.dc.html.
5. T5 Tests + e2e text updates; docs (README, MASTER, runbooks, project instructions).
6. T6 Checks, QA/security notes, status/handoff, Cloudflare/GitHub rename runbook.
Risk: missing a string → grep gate in QA.

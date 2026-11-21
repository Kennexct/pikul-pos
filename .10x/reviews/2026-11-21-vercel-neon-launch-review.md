# Review — vercel-neon-launch (v0.18.0), 2026-11-21

## QA — PASS
| Check | Result |
|---|---|
| `npm run typecheck` (app, server, Vercel adapter) | pass |
| `npm run i18n:check` | 1407 keys, 0 missing, 0 unused |
| `npm test` | 229 passed (44 files) |
| `npm run build` + `node scripts/vercel-build.mjs` | pass, function 338 KB |
| e2e `v18.py` on Vercel output, phone + tablet | pass |
| e2e `v17.py` on Vercel output, phone + tablet | pass |
| e2e `flow.py`, `v10.py`, `v16.py` (billing off) | pass |
| `db/neon-setup.sql` on Postgres 17 (PGlite), run twice | pass, 13 tables |
| No example data in `dist/` (`contoh0…`, preview) | none found |

## Security — PASS (see decisions/security/vercel-neon-launch.md)
Findings fixed during review: none blocking. Recommendations: Vercel Firewall rule on `/api/auth/*`; periodic `rate_events` cleanup; CAPTCHA if sign-up spam appears.

## Not verified here
A real Vercel deploy (routing on Vercel itself) and Neon over HTTP: covered by runbook step 5 smoke tests.

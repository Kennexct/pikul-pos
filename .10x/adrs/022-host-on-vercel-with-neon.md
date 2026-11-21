# ADR-022: Host on Vercel (Build Output API) with Neon; drop preview mode

**Status:** Accepted
**Date:** 2026-11-21
**Feature:** vercel-neon-launch
**Author:** 10x-Team (Architect + Staff Engineer)
**Supersedes:** the hosting part of ADR-013 (Cloudflare Pages + Pages Functions) and the preview mode of ADR-020.

## Context
Kenny chose Vercel for hosting and Neon for the database. The API was written for Cloudflare Pages Functions, but the request handling already lives in framework-free `server/` (`route(deps, method, path, auth, body, ctx)`); only `functions/api/[[path]].ts` is Cloudflare-specific. On Vercel today only the static build runs, so `/admin/` falls back to preview mode with example merchants, which Kenny wants gone.

## Decision
- One Vercel project. `npm run build:vercel` = Vite build + esbuild bundle of `server/vercel.ts` into one Node 22 function, written as **Build Output API v3** (`.vercel/output/static`, `.vercel/output/functions/api.func`, `.vercel/output/config.json`).
- `config.json` routes: security headers (from `public/_headers`), `/api/(.*)` → `/api`, filesystem, `/app/*` → `/app/index.html`, `/admin` → `/admin/index.html`.
- `server/vercel.ts`: Node `(req, res)` → `route()`. Requires `DATABASE_URL` and `PASS_PRIVATE_JWK` in production; `DEV_MODE=1` (memory repo) is refused when `VERCEL_ENV=production`.
- Public GETs: `Cache-Control: public, max-age=60, s-maxage=60`. No purge on admin writes; edits show within a minute.
- Client IP from `x-real-ip` (Vercel sets it), else first `x-forwarded-for`.
- Preview mode in `/admin/` is removed. No server → an error screen.
- Cloudflare adapter and files stay in the repo, unused, until Kenny confirms Vercel is live; a later cleanup can delete them.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| `api/[...path].ts` compiled by Vercel | No custom build step | Vercel compiles TS per file; with `"type": "module"` the extensionless imports in `server/` fail at runtime; catch-all routes outside Next.js are unreliable | Fragile |
| Vercel Edge runtime | Web `Request/Response` natively | Vercel steers new work to Node; tighter size and API limits | Node is the default and supports everything we use |
| Stay on Cloudflare Pages | Already built | Kenny chose Vercel | Owner decision |
| Keep preview mode | Console demo without a server | Shows example customers on production URLs | Kenny asked for real data only |

## Consequences
### Positive
- Same `server/` code and tests; adapter is ~80 lines. Deterministic build, testable locally by running the bundled function.
### Negative
- Custom build script to maintain (`scripts/vercel-build.mjs`).
- No instant cache purge for landing/app public data (60 s delay).
### Risks
- Build Output API format changes: pinned to v3; runbook includes a smoke test (`/api/public/landing` returns JSON).
- Neon cold start adds latency to the first request; acceptable (sign-in and admin only; selling is offline).

## Dependencies
ADR-023 (sign-up) adds the endpoints served here. Future: R2/Blob for images, cron for cleanup of `rate_events`.

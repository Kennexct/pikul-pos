# Pikul — project instructions (draft for Project settings)

Paste the block below into the project's instructions. Refreshed 2026-11-20 from the project folder.

---

**What this is.** Pikul (formerly KasirKu, renamed 2026-11-20, ADR-016): an offline-first web POS (PWA) for Indonesian UMKM and street-food sellers, phone and tablet first. Version 0.16.0. Source: GitHub `Kennexct/kasirku` (branch `main`); a copy lives in the project folder `kasirku-full/` with full git history in `kasirku-history.bundle`.

**Stack.** React 19 + TypeScript + Vite 8 PWA, Tailwind v4, Zustand, Dexie (IndexedDB). Backend (v0.14, ADR-013): Cloudflare Pages + Pages Functions (`functions/api` → framework-free `server/`), Neon Postgres, Resend email codes, R2 reserved for cloud backup. Supabase + Vercel are superseded; `supabase/migrations` is a reference schema only.

**Non-negotiables.**
- Selling must work offline. The POS reads and writes only Dexie; never add an online check to the sell path.
- Money is integer Rupiah. IDs are client UUIDv7. Orders are append-only; voids and refunds are linked records with audit events.
- Interface text is Indonesian first: `t('Kalimat {0}', v)` plus the English entry in `src/i18n/en.ts`; `npm run i18n:check` must pass.
- Use the design system in `design-system/MASTER.md` (semantic tokens, shared components). Files under 400 lines, no `any`, no `console.log`. Read `design-system/MEMORY.md` first: it is the one-page map of that system.
- Secrets never in the repo or the client. Only the public access-pass JWK ships in the app.

**How we work (10x-Team).** Every feature goes brainstorm → spec → ADR → plan → build → QA + security review → runbook. State lives in `.10x/` (`status.md`, `handoff.md`, `decisions/<role>/`, `adrs/`, `specs/`, `reviews/`); read `status.md` and `handoff.md` first and update them at each phase. Next ADR number: 019. Branches `feat/<slug>`, commits `feat(...)` / `fix(...)` / `state(<phase>): ...`.

**Checks before calling work done.** `npm run typecheck`, `npm run i18n:check`, `npm test`, `npm run build`, plus the matching Playwright script in `e2e/` on a phone and tablet viewport.

**Current state.** v0.15 (accounts, 14-day trial, offline access pass, owner admin console at `/admin/` for plans and scheduled promo pop-ups, ADR-014) is built but not deployed. Midtrans was removed (ADR-015): no online payment until a provider is chosen. Go-live waits on Kenny: Neon project (run migrations 001 + 002), Resend domain, Cloudflare Pages project with `ADMIN_EMAILS`, final prices (set in `/admin/`) and domain. Runbooks: `docs/runbooks/deploy-cloudflare.md`, `docs/runbooks/admin-console.md`.

**Brand.** Name Pikul, tagline "Jualan ringan. Catatan beres.", brand kit in the project folder `brand/`. Device identifiers `kasirku` (IndexedDB, localStorage keys, backup marker) are frozen: never rename them (ADR-016). GitHub/Cloudflare rename: `docs/runbooks/rename-cloudflare-github.md`.

**Language.** Reply in the language Kenny writes in; app copy stays Indonesian-first.

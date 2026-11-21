# admin-console-revamp (v0.17) — Architect (ADR-020)
## Components
Server (`server/`, framework-free, `Deps` injection):
- `adminAuth.ts` — login, lockout, admin sessions, `requireAdmin` (replaces email-based check in `admin.ts`).
- `ledger.ts` — pure: extend/cancel/grant maths, payment validation.
- `merchants.ts` — admin handlers: overview, list, detail, record/cancel payment, grant, payments list + CSV.
- `daily.ts` — pure validation of merchant daily rows + `POST /api/merchant/daily` handler.
- `analytics.ts` — pure post-processing (rates, weekday, buckets, top) + report handler.
- `siteContent.ts` — validation + defaults (`landing/content.json`).
- Repo split: `Repo = CoreRepo & AdminRepo`; `neonRepo` + `neonAdminRepo.ts`, `memoryRepo` + `memoryAdminRepo.ts`.
- `router.ts` gains a request context `{ ip, query }`.
Client:
- `src/admin/*` — login screen, tabs Ringkasan, Merchant (+ detail sheet, payment form, grant form), Pembayaran, Laporan, Paket harga, Kampanye, Konten landing; preview mode with fake data.
- `src/lib/dailyTotals.ts` — pure: Report → daily row. `src/services/dailyTotals.ts` — load from Dexie, post in background.
- `src/components/Access/RegisterPopup.tsx` + cache in `src/services/campaigns.ts`.
- `src/landing/live.ts` — applies content.
## Data flow
App (online) → `/api/merchant/daily` (refresh token) → `merchant_daily`. Console → `/api/admin/*` (admin token) → aggregates. Console → `/api/admin/content` → `site_content` → `/api/public/landing` (edge 60 s) → landing.
## Failure modes
- API down: app ignores; landing shows static text; console shows error with retry.
- Payment race: optimistic check → 409 `conflict`, console asks to reload.
- Bad daily row: whole request 400; app retries next trigger (no loop: next trigger is ≥ 30 min).

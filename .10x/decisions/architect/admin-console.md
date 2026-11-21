# admin-console (v0.15) — Architect (ADR-014, ADR-015)
Components
- `server/catalog.ts` pure rules: plan/campaign validation, `isLive`, `priceNow` (lowest live promo), `popupNow(where)`, `offers()`.
- `server/admin.ts` handlers: `/api/admin/{me,catalog,plans,campaigns,campaigns/:id[/toggle|/archive],images}`; public `/api/public/{landing,app,images/:id}` (edge-cached 60 s / 1 day; admin writes purge the local cache).
- Repo: `plans`, `campaigns`, `images` (base64 in Neon, ≤ 500 KB), `admin_audit` (migration 002).
- Client: `/admin/` third Vite entry (`src/admin/`, not precached); `src/landing/live.ts` redraws paid plan cards + landing pop-up; `CampaignPopup` in the app (once per account per device, online only).
- Midtrans removed (ADR-015): `GET /api/billing` = account + plans.
Failure modes: API down → landing keeps static fallback prices, no pop-up; app never waits on campaigns.

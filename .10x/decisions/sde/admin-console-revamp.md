# SDE — admin console revamp (v0.17, ADR-020)

Built on `feat/admin-console-revamp` (A1–C3 all done).
- Server: `server/adminAuth.ts` (password sign-in, sessions, lockout), `ledger.ts`, `merchants.ts`, `daily.ts`, `analytics.ts`, `siteContent.ts`, `csv.ts`, repos `memoryAdminRepo.ts` / `neonAdminRepo.ts`, routes in `router.ts`.
- App: `lib/dailyTotals.ts` (rows from `buildReport`), `services/dailyTotals.ts` (send in background), `components/Access/DailyTotals.tsx` (one-time notice + triggers), `RegisterPopup.tsx` + `services/registerPopup.ts`, `lib/appEvents.ts` (register opened / day closed).
- Console: `src/admin/` tabs Ringkasan, Merchant (+ `MerchantSheet`, `MerchantActions`, `MerchantSummary`), Pembayaran, Laporan, Paket harga, Kampanye (+ "Saat buka kasir pertama hari itu"), Konten landing (`ContentPanel`, `ContentList`). Preview mode = real `route()` in the tab (`preview.ts`).
- Landing: `landing/content.json` is the default text; `scripts/landing/build.py` adds `data-lp` hooks and an icon `<template>`; `src/landing/live.ts` redraws saved text with textContent.

Deviations from the plan
- Error codes made unique: `invalid_payment_amount`, `invalid_grant_days`, `invalid_content_features` (they clashed with plan errors).
- `BarChartCard` gained optional `count`/`isCount` and optional subtitle (sign-ups per week are counts, not Rupiah).
- `Section` now has `aria-label` (regions), sign-out button has `aria-label` (icon-only on phones).
- `/admin/*` now sends a strict CSP (token lives in sessionStorage).

Tech debt
- Daily totals come from one device per day until device sync exists; two devices on one store overwrite each other (newest computedAt wins).
- Campaign default start is the next full hour (unchanged); the e2e sets it to now.

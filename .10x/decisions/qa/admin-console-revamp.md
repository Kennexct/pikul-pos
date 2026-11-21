# QA — admin console revamp (v0.17)

- Unit/integration: 210 tests pass (`server/merchants.test.ts`, `server/reports.test.ts`, `server/admin.test.ts` cover sign-in, lockout, ledger + cancel, grants, 409 race, daily validation/limits, analytics, content, CSV injection; `src/admin/api.test.ts` sign-in flow + preview; `src/lib/dailyTotals.test.ts` same numbers as Laporan, totals-only privacy, server contract; `src/services/registerPopup.test.ts`).
- typecheck, i18n:check (1360 keys, 0 missing), build: pass.
- Browser, `e2e/v17.py` against `wrangler pages dev` (DEV_MODE=1, ADMIN_PASSWORD) on tablet 1024×768 and phone 390×844: wrong then right password → edit landing headline + new FAQ (HTML shown as text on `/`) → campaign "Saat buka kasir pertama hari itu" → merchant signs up, sees the daily-totals notice, opens the register, sees the banner once (not again after reload), sells → daily totals posted → console merchant summary shows the sale → record QRIS payment → Pembayaran month and Laporan (top 10) show it → sign out. No page errors, no 5xx.
- Regression on the static build (`VITE_BILLING=off`): `v16.py` (24 checks) and `flow.py` pass.
- Bugs found and fixed: sign-out button had no accessible name on phones; report tiles truncated on phones (now 2 columns); `Section` not a landmark.
- Not run here: real Neon (migration 003 smoke test is in the runbook), Safari/iPad.

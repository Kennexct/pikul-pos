# admin-console-revamp (v0.17) — Staff Engineer
- Files < 400 lines, no `any`, no `console.log`; server modules stay framework-free and unit tested with `memoryRepo`.
- Money integer Rupiah; dates: `business_date` = merchant's `YYYY-MM-DD`; admin "paid on" also `YYYY-MM-DD` (Asia/Jakarta for "today").
- All copy Indonesian-first via `t()` with English in `src/i18n/en.ts`; `npm run i18n:check` must pass.
- Reuse: `buildReport` (one metric definition), design-system components (`Tabs`, `Sheet`, `StatTile`, chart components, `btn*` styles), `server/catalog.ts` price logic for the payment form's suggested amount.
- Errors: server returns `{error: code}`; `src/admin/errors.ts` maps codes to Indonesian text.
- Audit every admin write (`admin_audit`): actor `admin:<session prefix>`.
- Background work in the app: never awaited by UI, swallow errors, no toast.
- Tests: pure modules first (ledger, daily validation, analytics, content), then handler tests through `route()` with `memoryRepo`.

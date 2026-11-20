# SDE — register-categories (v0.16) · ADR-017
Built:
- `lib/register.ts` (status rule), `lib/denominations.ts` (Rupiah notes/coins, `sumDenominations`) + `lib/register.test.ts`.
- `services/dayClosing.ts`: `hasOpening`; `setOpeningCash(storeId, date, amount, actorId)` now audits `register_opened` (first) / `opening_cash_changed` (from/to).
- `hooks/useCash.ts` `useRegister(storeId, date)` → `{ status, suggestedOpening }`.
- `components/Register/CashCounter.tsx` (collapsible count by note/coin), `OpenRegisterSheet.tsx` (mode open | edit, yesterday-unclosed warning).
- Kas: TodayPanel action reads "Buka kasir" until opened, then "Ubah"; the old inline opening sheet replaced by `OpenRegisterSheet`; CloseDaySheet gets `CashCounter`.
- POS: `useRegisterGate` (banner + sheet + `guard`), applied to first product tap with an empty cart, Bayar and Simpan. Closed day: warn once per visit, "Tetap jual". Phone cart bar extracted to `components/CartBar.tsx` (POSPage 396 lines).
- Categories: `services/categories.ts` (create unique, rename, move, delete → products to null, one transaction); `createCategory` moved out of `catalog.ts` (no longer takes sortOrder). UI `CategoriesPanel.tsx`, `CategoryForm.tsx`, third tab on Produk.
- Variant expand: `ProductRow.tsx` (toggle column, variant lines with Dine In / per-product mode price / status), "Buka semua varian" toggle next to search.
- Help (ID/EN) Kas + Produk topics, 35 new EN strings. Version 0.16.0.
Deviations from spec: added "Buka/Tutup semua varian" button (Kenny's "quick button to expand the list" could mean all rows; cheap to have both).
Tech debt: e2e `open_register` helper is duplicated per script (scripts run with `python3 -I`, no shared import).

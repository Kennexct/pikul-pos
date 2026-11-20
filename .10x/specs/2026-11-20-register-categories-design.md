# Register open/close, category tab, variant expand — design (v0.16)

**Date:** 2026-11-20 · **Feature slug:** `register-categories` · **Asked by:** Kenny (screenshot in the project thread)
**ADR:** ADR-017

## Problem
1. A seller can ring up the first sale of the day without ever saying how much cash was in the drawer. The Kas page has "Modal awal" (ADR-007), but it silently carries over the last closing's amount, so nobody counts at the start and the close-of-day difference is unreliable.
2. Close of day already asks for the counted cash and shows expected vs counted vs difference (ADR-007), but counting a drawer full of notes and coins in one number is error-prone.
3. Categories can only be created from inside the product form; there is no list, rename, reorder or delete.
4. In the product list, a product with variants shows the variant names as one truncated line; the owner cannot see each variant's prices or sold-out state without opening the form.

## Readings chosen (Kenny was away; reversible)
- "Check whether the register is open before the first sale" = a **register-open gate** at the cashier: until today's register is opened, the first product tap (empty cart), Bayar and Simpan pesanan open a **Buka kasir** sheet. Opening = confirming the opening cash count. Rp0 is allowed. Selling stays fully offline (Dexie only).
- "End of day, count the register balance" = keep the existing **Tutup kasir** (expected vs counted vs difference) and add an optional **count by denomination** helper, used in both Buka kasir and Tutup kasir.
- "Category button" = a third tab **Kategori** on the Produk page with the list (product count each), add, rename, move up/down, delete (its products become "Tanpa kategori").
- "Quick button to expand" = a chevron toggle on rows of products that have variants; expanding shows one indented line per variant with Dine In price, the per-product mode price (Takeaway), and status.

## Register states (per store, per business date)
| State | Rule | Cashier behaviour |
| --- | --- | --- |
| `not_open` | no opening recorded for the date, no counted sale yet, no closing | banner "Kasir belum dibuka" + gate on first sale |
| `open` | opening recorded (`meta openingCash:<store>:<date>`) **or** a counted sale already exists (devices upgraded mid-day) | nothing |
| `closed` | a live `DayClosing` for the date | banner "Kasir hari ini sudah ditutup"; the first sale shows a once-per-visit warning with "Tetap jual" (never blocks) and a link to Kas |

The business date follows the store's timezone and cut-off (unchanged). Yesterday unclosed: the Buka kasir sheet shows a warning with a link to close yesterday first; it does not block.

## Buka kasir sheet
- Amount prefilled with the suggested float (`getOpeningCash`: typed today, else last closing's opening cash), label "Uang di laci saat mulai jualan".
- Optional "Hitung per pecahan" (100.000 … 100) fills the amount.
- Button "Buka kasir". Writes the opening and an audit event `register_opened` (amount, actor).
- Can be dismissed ("Nanti saja"); the next Bayar/Simpan asks again. Opening is never required for browsing the menu.

## Kas page
- "Modal awal" line: when the day is not opened yet the action reads **Buka kasir** (same sheet); afterwards **Ubah** (writes `opening_cash_changed` audit with old/new amount).
- Tutup kasir sheet: adds the "Hitung per pecahan" helper; the rest is unchanged.

## Category tab
- Tab order: Produk · Add-on · Kategori (with counts). Header button becomes "+ Kategori".
- Row: name, "{n} produk", up/down buttons (44px), row tap = rename sheet with Delete.
- Names: required, ≤80 chars, unique case-insensitively among live categories.
- Delete: soft delete (`deletedAt`) and every product in it moves to "Tanpa kategori" in the same transaction. Confirmation states how many products move.
- Order is shared with the cashier's category tabs.

## Variant expand
- Only rows with ≥1 variant get the toggle (chevron, `aria-expanded`, `aria-controls`, 44px target); others get an equal spacer so columns line up when any product has variants.
- Expanded lines: variant name, Dine In price, mode price for the per-product mode (`variantPrice`), "Habis"/"Aktif". Tapping a line opens the product form.
- Expansion state is in memory only.

## Testing
- Unit: register status rules, `openRegister` audit + validation, `sumDenominations`, category rename/unique/delete-moves-products/reorder.
- e2e `e2e/v16.py`: phone + tablet — gate appears on first tap, open with denomination count, sale goes through, close with count shows difference; category tab add/rename/reorder/delete; variant expand toggle.

## Out of scope
Multiple shifts per day, per-cashier drawers, blind close, storing the denomination breakdown.

# Review — keyboard-safe sheets (v0.22.0, ADR-029)

**Date:** 2026-11-28 · **Verdict:** PASS (QA + security)

## Security
- UI only: no network, storage, or data-model change. Sell path still reads/writes Dexie only; no online check added.
- Keypad writes go through the same parsers (`parseRupiah` limits, `parseQuantity` ≤ MAX_QUANTITY) and the same validation before saving. Max 12 digits for Rupiah, 3 for percent, 5 + 3 decimals for weight.

## QA
- Unit: `lib/keypad.test.ts` (11): leading zeros, one comma, decimal cap, replace on first key, erase, digit limit, "000", null on empty.
- e2e `v26.py` phone + tablet: inputmode none on float/weight/cash; keypad builds 150.000, 1,5 kg (Rp35.100), price 25.000 (Rp37.500), cash 50.000 → change Rp12.500; main buttons on screen; note field hides the keypad; with a 400/340 px simulated keyboard the note and "Simpan pengeluaran" sit above it; keypad returns on the amount field. ERRORS: none.
- Regressions (use `fill()` on the same fields): v12, v16, flow, v09, staff, v24 pass on phone + tablet.

## Follow-ups (not blocking)
- Try on a real iPad: confirm no shortcut strip with `inputmode="none"` and the sheet size with the real keyboard.
- Product form price fields could get the keypad later if Kenny wants it there too.

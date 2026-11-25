# Open a new shift after closing (v0.20)

Kenny, 2026-11-25: "open register > when at the same day closing, and want to reopen again > just do open new register (not continue the latest closing)."

## Behaviour
1. After "Tutup kasir", the cashier's banner reads "Shift 1 ditutup 14.05" with "Buka shift baru". Tapping a product opens the same sheet.
2. The sheet is titled "Buka shift baru · Shift 2 · <date>", shows what the previous shift counted, and prefills the opening cash with it. The cashier can change it (cash taken out or added).
3. The closed shift keeps its figures. "Buka kembali" stays only as a correction of the last closing, before the next shift starts.
4. Kas: "Kas laci · Shift N" for the shift being viewed, "Semua shift hari ini" (per shift: closing time, transactions, sales, difference; then the day's total) and tapping a shift shows it.
5. "Riwayat tutup" names the shift on days with more than one; the WhatsApp summary says "· Shift N".
6. Reports and the daily totals already cover the whole day across shifts.

## Out of scope
Shifts per cashier, a shift across midnight (the business date cut-off decides the day), merging shifts in the admin console.

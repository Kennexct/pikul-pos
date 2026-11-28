# Spec — the keyboard never covers a sheet (v0.22.0, ADR-029)

**Ask (Kenny, 2026-11-28):** on iPad Safari the "Bayam / kg" weigh-out sheet is squeezed behind the on-screen keyboard; field and "Add to order" hidden. "Is there any effective way for tablet and phone view so it does not block the field while the user fills it?" → plan approved: in-app keypad for numbers, keyboard-aware sheets for text, inputmode where the system keyboard still appears. "Yes build it".

## Behaviour
- K1. Weigh-out / flexible-price sheet: weight, amount and price are typed on the keypad in the footer; "," key on weight, "000" on Rupiah; the system keyboard does not open. "Tambah ke pesanan" stays on screen.
- K2. Tapping another number field moves the keypad to it; the first key replaces its value; a quick chip (0,5 kg, Rp10.000, Uang pas…) restarts it.
- K3. Payment (cash), Diskon, Buka kasir / shift, Tutup kasir, Catat pengeluaran: same keypad.
- K4. A text field (Catatan, No. Ref, email, names) hides the keypad; the system keyboard opens and the sheet fits into the space above it, field and main button visible, focused field scrolled into view. Same for the QRIS screen's reference field.
- K5. Hardware keyboard and desktop typing keep working in every field.
- K6. Every number `<input>` that still uses the system keyboard has `inputMode` numeric/decimal (already true; checked).

## Out of scope
Full-page forms (Produk, Pengaturan, Admin) keep the system keyboard; the browser scrolls those fields into view.

## Checks
Unit `lib/keypad.test.ts`; e2e `v26.py` (phone 390×844, tablet 1133×744, simulated keyboard over the bottom) + regressions v12, v16, flow, v09, staff, v24.

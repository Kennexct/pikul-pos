# Cup labels for drink orders (v0.21, spec only)

Kenny, 2026-11-25: "possible add small label for fnb business, so every order, the label sticker can be add to the cup?" (photo: a 40×30 mm sticker reading "P0002 (GUEST) 1/1 · Matcha Signature · Iced, Less Sugar").
Answers: printers **Blueprint ECO 80BT** and **iware MP-581RL**; **one label per cup**; **Pro plan first**.

Status: **Draft, waiting for Kenny**. Decision record: ADR-028. Nothing is built yet.

## 1. What one label shows

```
A10002 · Dine In          2/3
Kopi Susu – Latte
Iced, Less Sugar, +Shot
Catatan: tanpa es batu
Mas jaket merah    14.05
```

| Line | Source (all on the order, offline) |
|---|---|
| Short order number | Last part of `receiptNo` (`BKS-20261125-A10002` → `A10002`) |
| Sales mode | `salesModeNameSnapshot` |
| Cup count `n/N` | Position among the order's labelled cups |
| Item | `nameSnapshot` (already "Product – Variant") |
| Add-ons | `options[].name`, comma separated, wrapped to 2 lines max |
| Note | `OrderItem.note`, 1 line, cut with "…" |
| Name | `label` (table / free text), else `customerNameSnapshot`, else nothing. Time = `openedAt` HH.mm |

Rules: no prices on the label. Long text shrinks one font step, then wraps, then cuts with "…"; the item name is never cut before the add-ons.

## 2. How many labels
- One label per cup: a line with `qty` 3 prints 3 labels. `N` counts every labelled cup in the order.
- Only lines whose product category has **"Cetak label"** on (drinks yes, snacks no). Products without a category follow a store default (off).
- Lines sold by weight or measure (ADR-011) print **one** label per line, whatever the quantity.
- Refunded or voided lines are not printed again on a reprint.

## 3. Seller flow
**Pengaturan → Label gelas** (new section, Pro):
- Switch "Cetak label gelas".
- Size: 40×30 mm (default), 50×30 mm, 58×40 mm.
- Printer on this device: "Hubungkan printer" (Bluetooth), shows name and status, "Cetak tes". Choice of printer is per device and never synced.
- When to print: "Setelah bayar" (default) and/or "Saat pesanan disimpan" (open orders, so the barista can start before payment).
- Categories: list with a switch each ("Cetak label"). Also on the category form in Kelola → Kategori.

**Kasir:** after payment / save, labels print in the background. A small toast "3 label dicetak" or "Label gagal dicetak · Coba lagi". **The sale is never blocked or delayed by printing**, and nothing prints when the switch is off or no category qualifies.

**Riwayat and Pesanan:** "Cetak ulang label" on the order sheet, with the choice "Semua" or one item (a dropped cup).

## 4. Printing paths
1. **Bluetooth (main path, Chrome on Android):** Web Bluetooth (BLE) connect once per device, remember it, reconnect silently with `navigator.bluetooth.getDevices()`. The label is drawn on a canvas, turned into a 1-bit bitmap (203 dpi: 40 mm = 320 dots), and sent as:
   - **TSPL** (`SIZE`, `GAP`, `CLS`, `BITMAP`, `PRINT`) for Blueprint ECO 80BT and other gap label printers;
   - **ESC/POS** raster (`GS v 0`) plus a feed to the next label for iware MP-581RL and other 58 mm receipt printers loaded with sticker rolls.
   The seller picks "Printer label (TSPL)" or "Printer struk (ESC/POS)" when connecting; the test print confirms it.
   Drawing a bitmap avoids printer code pages, so Indonesian text and any font print the same everywhere.
2. **Print dialog (fallback, any device incl. iPhone/iPad):** the same label as HTML, `@page { size: 40mm 30mm }`, one page per cup, `window.print()`. Used when Web Bluetooth is missing or the printer only speaks Bluetooth Classic. One extra tap per order; no automatic printing.

## 5. Plan gating (Pro first)
Today the access pass only knows `trial | paid`; there is no Pro tier. Proposal (ADR-028): plans get an `entitlements` list (`['cupLabels']`), the signed access pass carries it, and the app checks it offline. Without it the Label gelas section shows what it does and "Tersedia di paket Pro". Trial: see open question 3.

## 6. Data
- `Category.printsLabel?: boolean` (synced, absent = off).
- `Store.cupLabels?: { enabled; sizeMm: '40x30' | '50x30' | '58x40'; onPay; onSave; uncategorized }` (synced).
- Device-only (localStorage, not synced, not in backup): paired printer id, name, protocol `tspl | escpos`.
- Orders are not changed. A reprint writes an audit event `order.labels_reprinted` (who, which lines).
- Server: `PlanDef.entitlements: string[]`, pass claim `ent` (see ADR-028). One migration column on plans.

## 7. Out of scope (v1)
Kitchen tickets, a printed queue screen, QR on the label, label designer, logo, USB/Wi-Fi printers, printing on iPhone without the dialog, receipts over Bluetooth (the same transport can serve them later).

## 8. Checks when built
Unit tests: label model (counts, filters, measured lines, wrapping), TSPL and ESC/POS byte encoders (golden bytes). e2e: settings, auto print to a fake printer, reprint, print-dialog fallback, Pro lock; phone + tablet. Manual: both real printers with 40×30 stickers.

## 9. Open questions for Kenny
1. Short number on the label: the tail of the receipt number (`A10002`), or a daily queue number that restarts each day (`P0002`, like the photo)? A queue number is a new counter per device.
2. Which sticker size are you using on each printer (40×30 or 50×30)?
3. Should trial stores get labels for the 14 days (to try it), or only paid Pro?
4. Print at "save order" too, or only after payment?
5. Can you run a 2-minute test on both printers with the free app **nRF Connect** (Android): does the printer appear in the scan, and does it show a writable service? This decides if the Bluetooth path works or if we fall back to the print dialog (see ADR-028).

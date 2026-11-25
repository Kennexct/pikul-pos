# ADR-028: Cup labels print as a bitmap over Web Bluetooth, with the print dialog as fallback, gated by a plan entitlement

**Status:** Proposed — waiting for Kenny (spec `specs/2026-11-25-cup-labels-design.md`)
**Date:** 2026-11-25
**Feature:** cup-labels
**Author:** 10x-Team (Architect + PM)

## Context
F&B sellers want a sticker on every cup: order number, item, add-ons, note, `n/N`. Kenny's printers are the **Blueprint ECO 80BT** and the **iware MP-581RL**, one label per cup, Pro plan first.

Printer findings (seller and distributor spec pages, 2026-11-25):

| | Blueprint ECO 80BT | iware MP-581RL (BT name RPP02N) |
|---|---|---|
| Kind | Desktop **label** printer, gap sensor, "tidak bisa continuous" | Portable 58 mm **receipt** printer; sticker rolls work, black-mark supported |
| Width | up to 78 mm print, 203 dpi | 58 mm (smaller rolls OK), 203 dpi |
| Commands | **TSPL / CPCL** (no ESC/POS) | **ESC/POS** (no TSPL) |
| Bluetooth | "Bluetooth only HP Android" + USB; version and BLE not stated | USB + Bluetooth; listed as Android **and iOS** compatible |

So the two printers speak **different languages**, and neither page says whether Bluetooth is BLE or Classic (SPP).
- Web Bluetooth (Chrome on Android, desktop Chrome) talks **BLE only**. Safari on iPhone/iPad has no Web Bluetooth at all.
- Web Serial over Bluetooth Classic (SPP) exists only in **desktop** Chrome (117+); not on Android.
- "Android only" for the Blueprint hints at Classic SPP only; "iOS compatible" for the iware hints at BLE (iOS apps cannot use SPP without MFi). Many cheap printers are dual-mode. **This must be confirmed on the real printers** (nRF Connect scan) before building.

The existing receipt print path is `window.print()` + `@media print` on `.receipt` (58/80 mm). There is no Bluetooth or command-encoding code to reuse; the print-dialog pattern is reusable for the fallback.

Access today: the signed pass has `plan: 'trial' | 'paid'`; `PlanDef.features` is marketing text only. There is no Pro tier.

## Decision
1. **Label model is pure and offline.** `lib/cupLabels.ts` builds the labels from the order in Dexie (one per cup, category filter, measured lines once). No network on any step; printing runs after the order is saved and never blocks or delays the sale.
2. **Render once, as a bitmap.** Each label is drawn on a canvas at 203 dpi (40×30 mm = 320×240 dots) and reduced to 1-bit. This avoids printer code pages and font limits, and one renderer serves every printer and the preview.
3. **Two thin encoders** turn the bitmap into bytes: TSPL (`SIZE/GAP/CLS/BITMAP/PRINT`) for label printers, ESC/POS raster (`GS v 0` + feed) for receipt printers. The seller picks the type when connecting; "Cetak tes" confirms.
4. **Transport: Web Bluetooth (BLE)** on Chrome Android, writing in chunks to the printer's writable characteristic (known service UUIDs listed as `optionalServices`). The paired device is remembered per device (localStorage) and reconnected with `getDevices()` without a prompt. Desktop Chrome may add Web Serial (SPP) later behind the same `LabelTransport` interface.
5. **Fallback: print dialog.** The same label as HTML with `@page { size: <label size> }`, one page per cup, `window.print()`. Used on iPhone/iPad, on browsers without Web Bluetooth, and for printers that only speak Classic SPP. No auto print in this mode.
6. **Gating: plan entitlements.** `PlanDef.entitlements: string[]` (admin-editable), the signed access pass gets claim `ent: string[]`, and the app checks `ent.includes('cupLabels')` offline. A missing claim (old pass) means no entitlements. The pass stays verifiable offline with the shipped public JWK.
7. **Data:** `Category.printsLabel`, `Store.cupLabels` (both synced, optional, absent = off). Orders unchanged. Reprints add an audit event.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Print dialog only | Any printer, iPad works, no new code path | Extra tap per order; Android print services for these printers are vendor apps; slow at rush hour | Kept as fallback, not main path |
| Text commands (TSPL `TEXT`, ESC/POS text) instead of bitmap | Smaller payload, faster | Code-page and font issues, two layout engines, no reliable preview | Bitmap is one layout for all |
| Vendor app intent / RawBT-style bridge app | Works with Classic SPP on Android | Second app to install, not offline-proof inside the PWA, brittle | Revisit only if both printers are SPP-only |
| Native wrapper (Capacitor) for Classic Bluetooth | Full SPP and iOS BLE | Leaves the pure PWA, app-store work | Too big for v1 |
| `plan === 'paid'` as "Pro" | No server change | No way to sell a cheaper non-Pro plan later | Entitlements cost one column and one claim |

## Consequences
Positive: works offline; one renderer for both printers; new printers only need the right encoder; the entitlement claim is reusable for later Pro features.
Negative: iPhone/iPad sellers get the dialog only; a Classic-only printer cannot print silently from the PWA; a pass refresh is needed before a newly paid Pro store sees the feature.
Risk: **the Blueprint ECO 80BT may be Bluetooth Classic only**. If the nRF Connect test shows no BLE service, that printer works on Android only through the print dialog (or the vendor app), and we should recommend a BLE label printer to sellers. This is the first thing to verify.

# ADR-018: A new store starts empty; example menus removed

**Status:** Accepted
**Date:** 2026-11-21
**Feature:** remove-mock-data
**Supersedes:** the starter-template part of ADR-009 (and the coffee template in ADR-012)
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
Kenny: "remove all the mockup data". Up to v0.16 the first-time journey seeded an example menu (4 business templates with products, categories, add-on groups) and two example discounts ("Promo Jumat", "Potongan Langganan"); "Lewati, pakai contoh toko" took the bakso menu. Real merchants then had to find and delete products they never sell, and example discounts showed up at checkout.

## Decision
1. **New store = config only.** `services/storeSetup.ts` (`buildStoreBundle`) creates the store, owner, sales modes (Dine In, Takeaway, GoFood/Grab off) and the payment methods the merchant picked. No products, categories, add-on groups or discounts. Sales modes and payment methods are working settings, not example data, and selling needs them.
2. **Onboarding:** the "Jenis usaha" template picker is gone; "Lewati" creates the same empty store with the default name.
3. **Empty states:** the cashier grid shows "Menu masih kosong" with a "Tambah produk" button to Produk. The "Langkah awal" item becomes "Tambah menu" (done when any product exists).
4. **Existing devices:** `removeLegacySampleMenu` runs once per device on start (meta key `legacySampleMenuRemovedAt`). Seed rows are recognised by `createdAt === updatedAt === owner.createdAt` (the seed stamped every row with one timestamp). It soft-deletes, through `saveAndQueue`, only rows that were never edited and never sold: products not in any order, discounts not used on any order, categories and add-on groups no kept product still uses. One audit event `sample_menu_removed` with counts. Failures are swallowed so the app always opens; it retries next start. New stores set the marker at creation.
5. **Tests:** the menus moved to `src/test/sampleMenu.ts` (test-only, `seedSampleMenu`). Nothing in app code imports it, so it is not in the bundle. e2e flows that need something to sell write the same sample rows into IndexedDB through `e2e/sample_menu.py` after "Lewati".

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
| --- | --- | --- | --- |
| Keep templates, default to "Mulai kosong" | Quick start for some merchants | Still ships example data; Kenny asked to remove it | Direct ask. |
| Delete seed rows by name match | Simple | Would remove a merchant's real "Es Teh" | Timestamp + untouched + unsold is exact. |
| Leave old devices alone | Zero risk | Old installs keep the mock menu | Cleanup only touches rows the merchant never used. |
| Hard delete | Smaller DB | Sync/outbox expects soft delete | Consistent with categories/expenses. |

## Consequences
- A fresh install has nothing to sell until the merchant adds a product (one extra step, shown by the empty state and checklist).
- Old devices lose untouched example items on update; edited or sold ones stay and can be switched off in Produk.
- No Dexie version bump, no schema change, sell path unchanged.

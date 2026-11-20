# ADR-017: Register-open gate on the device, category management, variant expand

**Status:** Accepted
**Date:** 2026-11-20
**Feature:** register-categories
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
Kenny asked that the first sale of the day checks the register is opened with a cash count, and that the day ends with a counted drawer balance. ADR-007 already gives one `DayClosing` per business date with expected/counted/difference, and an opening cash stored in `meta` under `openingCash:<store>:<date>` that falls back to the last closing's figure. Selling must stay offline and never depend on the network. Also asked: a Category tab on Produk and an inline variant expand in the product list.

## Decision
1. **"Opened" = an opening cash recorded for that business date** (the existing `meta` key). No new table and no Dexie version bump. `openRegister()` writes it plus an audit event `register_opened`; editing after opening writes `opening_cash_changed` (old/new).
2. Register status is derived (`lib/register.ts`, pure): `closed` if a live closing exists; `open` if an opening is recorded **or** a counted sale exists on the date (devices upgraded mid-day are not blocked); else `not_open`.
3. The gate lives in the cashier UI only (`useRegisterGate`): first product tap with an empty cart, Bayar and Simpan pesanan. `completeOrder` / `saveOpenOrder` are **not** changed, so restores, tests and any future import path keep working and the sell path has no new failure mode. A closed day warns once and never blocks (matches ADR-007 "selling was never blocked").
4. No denomination counter: the seller types one total (a counter was built and removed at Kenny's request, 2026-11-20).
5. Categories: `saveCategory` (rename, unique case-insensitive), `moveCategory` (swap `sortOrder`, renumber), `deleteCategory` (soft delete + null `categoryId` on its products, one Dexie transaction, all through `saveAndQueue`). Owner-only by the existing `OwnerGate` on Produk.
6. Variant expand is presentation only.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
| --- | --- | --- | --- |
| New `registerShifts` table (open/close records, many per day) | Multiple shifts, per-cashier drawers | Dexie v5 + sync table + backup + reports changes; duplicates `DayClosing` | Kenny asked for open before first sale and count at end of day; one shift per business day matches ADR-007. Revisit with multi-device sync. |
| Enforce "opened" inside `completeOrder` | Cannot be bypassed | Adds a failure mode to the sell path; breaks restores/tests; a bug would stop sales | Gate in UI is enough for an honest-seller control; audit trail shows who opened. |
| Block sales after closing | Keeps closing exact | A late customer cannot be served | ADR-007 chose never block; the stale warning already handles it. |
| Hard-delete categories | Simple | Sync/outbox expects soft delete; orphan `categoryId`s | Soft delete + move products is consistent with the rest. |

## Consequences
### Positive
- Every day starts with a counted float; the closing difference becomes meaningful. Owner sees who opened and any later change in the audit log.
- No schema migration; backups (meta is portable) carry the opening.
### Negative
- "Opened" is per device (as are sales until sync exists).
- The gate adds one sheet to the first sale of the day.
### Risks
- A seller can type any opening amount. Mitigation: audit events; the closing difference exposes it.

## Dependencies
ADR-007 (Kas, closing), ADR-004 (owner gate), ADR-012 (variants). Multi-device sync will need to merge openings (future ADR).

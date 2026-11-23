# ADR-026: Each device keeps its own cash register

**Status:** Accepted — Kenny chose "Each device has its own" (2026-11-21)
**Date:** 2026-11-21
**Feature:** device-sync
**Author:** 10x-Team (Architect + PM)

## Context
With sync (ADR-025) every device sees every sale. The register gate, opening cash, drawer maths and "Tutup kasir" (ADR-007, ADR-017) were written for one device per store, so device B would see A's sales and closing and think its own drawer is open or closed.

## Decision
- Every device has a random `deviceId` (UUID, `meta: deviceId`), separate from the 2-character receipt code.
- Orders (set again when paid, so the cash counts where it was taken), refunds, expenses and day closings carry `deviceId`. A Dexie v5 upgrade stamps records made before v0.19 with this device's id.
- Opening cash already lives in this device's `meta` (not synced) and stays there.
- Kas page, register gate, unclosed-day warning and `closeDay` use only this device's records; one closing per device per day.
- Owner sees "Semua perangkat" on the Kas page: each device's closing (or "belum tutup") for the day and the store total. Device names come from the server list ("Perangkat 1…", renamable in Settings → Sinkronisasi).
- Reports, history, dashboard checklist and daily totals stay store-wide.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| One register for the store | One count | Needs every device online to close; can't see who is short | Kenny chose per device |
| Per cashier (staff member) | Follows people | A cashier can switch phones mid-day; cash box is physical | The drawer belongs to the device |

## Consequences
Positive: works offline, shows which device is short. Negative: owner closes each device separately. Risk: a device that never syncs leaves its closing missing in "Semua perangkat" — shown as "belum tersinkron".

# ADR-024: Two-way device sync through Neon, one store per account, last write wins

**Status:** Accepted — Kenny chose "Everything, both ways" and "Ask which store to keep" (2026-11-21)
**Date:** 2026-11-21
**Feature:** device-sync
**Author:** 10x-Team (Architect + Staff Engineer + DBA + Security)

## Context
Store data lives only in each device's IndexedDB. Signing in on a second device shows store setup (Kenny's report). Every write already goes through `saveAndQueue` (record + outbox row in one IDB transaction), but the outbox was built for a Supabase push that was never configured and nothing pulls. Hosting is Vercel functions + Neon (ADR-022); the merchant's bearer token is the refresh token (ADR-013/020). Selling must never wait for the network.

## Decision
- **Store binding:** `account_store(account_id → store_id)`. The first device that syncs claims it (`POST /api/sync/claim`). Every push/pull carries `storeId`; a different id gets `409 store_mismatch`.
- **Records:** one generic table `sync_records(account_id, tbl, id, data jsonb, updated_at, device_id, seq, changed_at)`, PK `(account_id, tbl, id)`. The device's record JSON is stored as-is (camelCase). `tbl` is one of the 13 sync tables plus `stores`.
- **Push** `POST /api/sync/push {storeId, deviceId, records[]}`: ≤100 records / 4 MB, each ≤1.5 MB. Upsert only when the incoming `updatedAt` is newer (last write wins). Orders never move from a final status back to `open`. Each accepted write takes `seq = nextval('sync_seq')`.
- **Pull** `GET /api/sync/pull?storeId&deviceId&after=<seq>`: rows with `seq > after`, excluding rows last written by the caller, oldest first, 500 per page, only rows whose `changed_at` is at least 3 s old so a slower concurrent insert with a lower seq is never skipped. The device applies a row only if it is newer than its own copy, without re-queuing.
- **Device:** push first, then pull, on start, every 15 s while visible and online, on `online`, and on demand. Outbox entries are deleted only after the server accepts them. Never on the sell path.
- **Binding on sign-in:** device with no store downloads the account's store; device with a store and an empty account claims and uploads everything; different store ids → the merchant chooses (backup file of the store not kept). A device whose store is tied to another account never uploads it: it is saved to a backup file and removed.
- **Replace** `POST /api/sync/replace {storeId, password}` deletes the account's records and rebinds; other devices then get `store_mismatch` and the choice screen.
- **Devices:** `sync_devices(account_id, device_id, name, receipt_code, first_seen, last_seen, app_version)`; if two devices share a 2-character receipt code, the newer device takes a new one.
- The unused Supabase client and dependency are removed.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| One Postgres table per Dexie table (the old Supabase schema) | Queryable columns, constraints | 14 tables + migrations for every field change; app and DB versions must move together | The server only stores and relays; reporting uses daily totals (ADR-020) |
| CRDT / per-field merge | Fewer lost edits | Large dependency and complexity | Collisions are rare (sales are new records; menu edits by one owner) |
| Pull by `updated_at` timestamp | No sequence | Client clocks drift; equal timestamps lose rows | Server sequence is exact |
| Websocket live push | Instant | Not on Vercel functions; battery | 15 s polling is enough for a street stall |
| Backup/restore only | Simple | No ongoing sync; reports per device | Kenny chose everything both ways |

## Consequences
### Positive
- A new device is ready in one download; all devices see the same menu, staff, customers and sales; admin totals cover all devices.
### Negative
- Personal data (customer names/phones, PIN hashes) is now stored in Neon. Edits made offline on two devices to the same product: the later one wins.
- `sync_records` grows with every sale (~1–3 KB each); about 1 GB per 500k orders.
### Risks
- Wrong-store overwrite → binding check on every call, choice screen, backup files before any replacement, password on replace.
- Concurrent-insert gap → 3 s settle window on pull; apply is idempotent.
- Clock skew decides last write wins → acceptable for menu edits; orders protected by the status rule.

## Dependencies
ADR-013 (bearer token), ADR-020 (daily totals), ADR-022 (Vercel + Neon), ADR-008 (backup file format). Constrains later R2 photo storage and the merchant back-office (which can read `sync_records`).

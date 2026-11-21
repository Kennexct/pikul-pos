# Store sync across devices (v0.19) — design

**Date:** 2026-11-21 · **Feature slug:** `device-sync` · **ADRs:** 024 (sync protocol and store binding), 025 (cash register per device)
**Asked by Kenny:** "i was create account before, then at other device im sign in with the account again, it show like the new account" → "yes start it". "at the same email sign in on second device, it went through store setup … i think it supposed to be store account already show".

**Kenny chose (decision cards, 2026-11-21):**
1. What syncs: **everything, both ways** (menu, settings, staff, customers, sales, refunds, expenses, closings, audit log).
2. A device that already has a different store: **ask which store to keep**; the store not kept is saved as a backup file first.
3. Cash register with several devices: **each device has its own** opening, expenses from the drawer and closing; owner sees every device plus a store total.

## Goals
1. Signing in on a new device loads the account's store and goes straight to the PIN / cashier screen. No store setup.
2. Every change on one device reaches the others within about 15 seconds when both are online, and whenever a device comes back online.
3. Selling still works fully offline. The sell path never waits for the network (project non-negotiable).
4. Nothing is lost: a store that is replaced is always saved as a backup file first.
5. Admin daily totals and reports count every device's sales.
6. If the account has no store yet, store setup is prefilled with the store name from sign-up on any device (fixes Kenny's note even before any sync).

## Non-goals
Live push (websockets), photo storage in R2, merchant back-office on the web, several stores per account, per-field merge, staff accounts with their own logins (staff still use PINs on a signed-in device).

## 1. What syncs
All 13 existing sync tables (`categories, products, variantGroups, salesModes, paymentMethods, discounts, customers, orders, refunds, auditEvents, storeMembers, expenses, dayClosings`) plus the **store row** (`stores`, new in the sync list).
Stays per device (never synced): receipt counters and device code (receipt numbers already carry the device code, so two devices never clash), PIN lockout counters, cart, language, last-backup time, sync cursor.

## 2. How it works
**Push.** Every write already goes through `saveAndQueue` (record + outbox entry in one transaction). The old Supabase push is replaced by `POST /api/sync/push` with batches of up to 100 records or ~1 MB, whichever comes first. The outbox entry is deleted only after the server accepts it. Retries are safe: the server upserts by record id.
**Pull.** `GET /api/sync/pull?after=<cursor>` returns records changed on the server after the cursor, oldest first, 500 per page, plus the next cursor. The device applies them straight into IndexedDB **without** re-queuing them.
**Conflict rule.** Last write wins per record by `updatedAt`, on the server and on the device. Orders, refunds, expenses, closings and audit events are new records almost always, so in practice only menu and settings edits can collide, and the later edit wins. Status changes to orders (open → paid → voided) only move forward: the server never lets an order go back from `paid`/`voided`/`refunded` to `open`.
**When.** On app start, every 15 s while the app is open and online, when the device comes back online, and from "Sinkronkan sekarang" in Settings. Push first, then pull. Never on the sell path.
**Size.** Product photos (≤200 KB) and the QRIS image (≤1 MB) travel inside their records as today. Body limit for `/api/sync/push` is 4 MB (Vercel allows 4.5 MB).

## 3. Store binding and sign-in on a device
The server stores one store per account (`account_store`). The device remembers which account its store belongs to (`meta: sync.accountId`).

After sign-in the app asks `GET /api/sync/store` and follows this table:

| Device | Account on server | What happens |
| --- | --- | --- |
| No store | Has a store | "Mengunduh data toko…" with progress, full pull, then PIN screen / cashier. **(Kenny's case)** |
| No store | No store | Store setup, store name prefilled from the sign-up profile. Finishing setup claims the account. |
| Has store, never synced | No store | The device's store becomes the account's store; everything is uploaded in the background. **(Kenny's first phone)** |
| Has store, same id | Same store | Normal sync. |
| Has store, different id, not tied to another account | Has a store | **Choice screen** (below). |
| Has store tied to another account | anything | This device's store is saved as a backup file, then removed, then it continues as "No store". Another account can never take over this data. |

**Choice screen** "Toko mana yang dipakai di perangkat ini?" shows both stores (name, number of products, number of sales, last sale date):
- **"Pakai toko dari akun"** (recommended when the account's store has more sales): downloads a backup file of this device's store, clears the device, downloads the account's store.
- **"Pakai toko di perangkat ini"**: downloads the account's store into a backup file first, then asks the server to replace it. Needs the account password again. Other devices that still hold the old store get the choice screen next time they sync (their store id no longer matches) and are offered "Pakai toko dari akun".
The backup files use the existing backup format (ADR-008), so they can be restored later from Settings → Cadangan.

If the device is offline at sign-in with no store, it shows "Perlu internet untuk mengunduh toko" with a retry button, plus "Buat toko baru" as an escape hatch.

## 4. Cash register per device (ADR-025)
- Each device gets a stable device id (the existing device code) stamped on new orders (at payment), refunds, expenses and day closings, and on the `register_opened` audit event.
- The Kas page, the register gate before the first sale, the opening count, drawer expenses and the closing all use **this device's** records only.
- Records made before v0.19 have no device id: a one-time upgrade stamps them with this device's code, since they were all made here.
- Owner sees on the Kas page a "Semua perangkat" section: each device's opening, expected cash, counted cash and difference for the day, and the store total. Devices are named "Perangkat 1, 2…" by first appearance, with rename in Settings.
- Reports, history, the dashboard and admin daily totals are store-wide (all devices).
- An open order (tab/table) can be started on one device and paid on another; the cash counts on the device that took payment.

## 5. Settings → Sinkronisasi
Status line ("Tersinkron 2 menit lalu" / "12 perubahan menunggu internet" / "Sinkronisasi tertunda"), "Sinkronkan sekarang", this device's name, and the list of devices seen on the account. The top bar keeps its existing pending count.

## 6. Server and database (DBA)
Migration `db/migrations/005_device_sync.sql` (also added to `db/neon-setup.sql`):
- `account_store (account_id pk → accounts, store_id uuid, bound_at, replaced_at)`.
- `sync_records (account_id, tbl text, id uuid, data jsonb, updated_at timestamptz, deleted boolean, seq bigint, device_id text, primary key (account_id, tbl, id))` with index `(account_id, seq)`. `seq` comes from one sequence, so pulling "after cursor" never misses a write.
- `sync_devices (account_id, device_id, name, first_seen, last_seen, app_version)`.
Endpoints (all need the signed-in bearer token, like daily totals): `GET /api/sync/store`, `POST /api/sync/claim`, `POST /api/sync/push`, `GET /api/sync/pull`, `POST /api/sync/replace` (password required). Validation: table name from the list, UUID ids, `storeId` in every record equals the account's store, record ≤1.5 MB, timestamps sane. Rate limit per account. Admin "Hapus akun" later deletes these rows too.
Admin daily totals keep working; because every device now has every sale, whichever device sends last sends the full store total.

## 7. Error handling
- Push fails (offline, 5xx): outbox keeps the entries, retry next tick; after 10 failed tries the status shows "Sinkronisasi tertunda" (existing toast), data stays safe on the device.
- Server says `store_mismatch` (account's store was replaced from another device): stop syncing, show the choice screen.
- Signed out / expired session: sync pauses; selling continues (access pass rules unchanged).
- A record the server rejects as invalid is kept on the device, marked with the error, and skipped so it never blocks the rest.

## 8. Clean-up
Delete the unused Supabase client (`src/services/supabase.ts`, `@supabase/supabase-js`) and the Supabase table mapping in `sync.ts` (open item in status.md).

## 9. Security and privacy
- Customer names and phone numbers, staff PIN hashes and recovery-code hashes now leave the device and are stored in Neon. They are already hashed with PBKDF2 (ADR-003); data is only readable with the account's token; no admin screen shows synced records. The privacy note in Help is updated ("Data toko disimpan di perangkat dan dicadangkan ke server Pikul").
- One account can only read and write its own store's records (checked on every call).
- The "replace" call needs the password, so a stolen phone with a session cannot silently wipe the account's store.

## 10. Testing (QA)
- Unit: push batching, cursor paging, last-write-wins both sides, order status never goes back, device id stamping and per-device cash, binding table (all 6 rows), choice screen actions make backup files.
- Server: auth, wrong store, bad table/id, oversized record, replace with wrong password, seq ordering with concurrent pushes.
- e2e `e2e/v19.py` on phone + tablet against the Vercel output with two browser contexts as two devices: sign up on A, add menu and sell; sign in on B → lands on the cashier with A's menu and sale; edit price on B → appears on A; each device opens and closes its own register; offline sale on A syncs when back online.
- All existing checks: typecheck, i18n:check, unit tests, build, Vercel build, prior e2e.

## 11. Rollout
1. Kenny runs `005_device_sync.sql` on Neon (or the regenerated `neon-setup.sql`).
2. Merge the PR; Vercel deploys.
3. Open the app on the **first phone** first (it uploads its store), then sign in on the second phone and choose "Pakai toko dari akun".

# Senior engineer — device-sync approach
- Server LWW: fetch existing `(id, updated_at, status)` for the batch, decide in TS (`shouldApply`), then `insert … on conflict do update … where sync_records.updated_at <= excluded.updated_at` (race guard). Final order statuses: paid, voided, refunded, partially_refunded, cancelled — never back to open.
- Pull settle window: `changed_at < now() - 3s`; client cursor = last row seq.
- Client apply: group rows by table, `bulkGet` local, keep newer, `bulkPut` in one rw transaction over that table only. `stores` row → `localDb.stores`.
- First claim on an existing device: clear outbox, enqueue every row of every table + store (chunked), then push.
- Choice "use account's store": backup file of local (existing `createBackup`), wipe all tables + store-scoped meta (keep deviceId, receipt code, language), set binding, full pull.
- Choice "use this device's store": full pull into memory → backup file via the backup builder, then `replace` with password, then enqueue-all + push.
- Backup files are downloaded via the existing share/download helper used by Settings → Cadangan.
- Receipt code clash: devices list from server; if another device (earlier first_seen) has my code, generate a new one and report it.

# DBA — device-sync (v0.19, ADR-024)

Migration `db/migrations/005_device_sync.sql` (also in `db/neon-setup.sql`, idempotent, verified twice on Postgres 17 via PGlite):
- `account_store(account_id pk → accounts on delete cascade, store_id uuid, bound_at, replaced_at)`: one store per account.
- `sync_records(account_id, tbl, id uuid, data jsonb, updated_at timestamptz, device_id text, seq bigint default nextval('sync_seq'), changed_at)`, pk `(account_id, tbl, id)`, index `(account_id, seq)` for the pull cursor.
- `sync_devices(account_id, device_id, name, receipt_code, first_seen, last_seen, app_version)`, pk `(account_id, device_id)`.
Write path: one `insert … select from jsonb_to_recordset($1) on conflict do update … where sync_records.updated_at <= excluded.updated_at`, seq re-drawn on update so pulls see it. Replace (keep this device's store) deletes the account's rows and rebinds in one transaction.
Size: ~1 KB per order; 300 orders/day ≈ 110 MB/year/merchant before compression. Watch Neon storage; archive/compaction is a later decision.
Rollback: tables are additive; v0.18 ignores them.

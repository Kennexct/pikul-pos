# DBA — vercel-neon-launch
- 004: `accounts` + `password_hash text`, `password_changed_at timestamptz`, `owner_name/store_name/phone/city text not null default ''`. Additive only; old code unaffected.
- `db/neon-setup.sql` = 001..004 in one transaction, idempotent (create if not exists / add column if not exists / on conflict do nothing). Verified twice in a row on PGlite (Postgres 17 wasm) and the account queries of `neonRepo` ran against it.
- Seeds: only the two plans from 002 (product price list). No example accounts, payments or totals.
- No new indexes: admin search scans `accounts` in the function (fine to thousands). Revisit with trigram index on store/owner if > 10k merchants.
- `rate_events` grows with failed logins and sign-ups; runbook has a cleanup query.

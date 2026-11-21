# DBA — admin console revamp (migration 003)

`db/migrations/003_admin_revamp.sql` (run after 001 and 002, idempotent `if not exists`):
- `accounts.last_seen_at` (touched on token refresh, best effort).
- `payments` append-only ledger: method check, `cancelled_at`/`cancel_reason` set together, indexes on (account_id, paid_on) and paid_on.
- `account_grants` (1–60 days, reason), `admin_sessions` (sha-256 token hash, expires_at), `rate_events(key, at)` for login lockout and daily-post limits.
- `merchant_daily` PK (account_id, business_date): fixed pay-type columns + `modes`/`hours` jsonb; upsert keeps the newest `computed_at`.
- `campaigns.show_on_register boolean default false`; `site_content` single row (id = 1).

Concurrency: recording/cancelling a payment updates `accounts.paid_until` only if it still equals the value read (CTE conditional write); a race returns 409 `conflict`.
Growth: `merchant_daily` ≈ 365 rows per active merchant per year; `rate_events` should be pruned (> 1 day old) — see SRE.

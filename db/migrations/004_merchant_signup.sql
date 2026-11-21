-- v0.18 merchant sign-up with password and profile (ADR-023). Neon Postgres. Run after 001, 002 and 003.
-- The profile is what the merchant typed on the sign-up page; the admin console shows it in Merchant.

alter table accounts add column if not exists password_hash text;
alter table accounts add column if not exists password_changed_at timestamptz;
alter table accounts add column if not exists owner_name text not null default '';
alter table accounts add column if not exists store_name text not null default '';
alter table accounts add column if not exists phone text not null default '';
alter table accounts add column if not exists city text not null default '';

-- Admin search by store or owner name stays fast enough as a sequential scan for thousands of rows; no index yet.
-- rate_events grows with failed sign-ins; old rows can be removed any time:
--   delete from rate_events where at < now() - interval '1 day';

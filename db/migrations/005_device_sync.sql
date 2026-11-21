-- v0.19 device sync (ADR-024). Neon Postgres. Run after 001–004.
-- One store per account; every synced record is stored as the device's JSON, last write wins by updatedAt.

create table if not exists account_store (
  account_id uuid primary key references accounts(id) on delete cascade,
  store_id uuid not null,
  bound_at timestamptz not null default now(),
  replaced_at timestamptz
);

create sequence if not exists sync_seq;

create table if not exists sync_records (
  account_id uuid not null references accounts(id) on delete cascade,
  tbl text not null,
  id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null,
  device_id text not null,
  seq bigint not null default nextval('sync_seq'),
  changed_at timestamptz not null default now(),
  primary key (account_id, tbl, id)
);
-- Pull reads "everything after my cursor" for one account.
create index if not exists sync_records_pull_idx on sync_records(account_id, seq);

create table if not exists sync_devices (
  account_id uuid not null references accounts(id) on delete cascade,
  device_id text not null,
  name text not null default '',
  receipt_code text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  app_version text not null default '',
  primary key (account_id, device_id)
);

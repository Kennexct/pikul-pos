-- v0.17 business console (ADR-020): payments ledger, trial grants, admin sessions, rate limits,
-- merchant daily totals, landing content, register pop-up placement. Neon Postgres. Run after 001 and 002.

alter table accounts add column if not exists last_seen_at timestamptz;

-- Manual subscription payments. Append-only: a wrong entry is cancelled (cancelled_at), never deleted.
create table if not exists payments (
  id uuid primary key,
  account_id uuid not null references accounts(id),
  plan_id text references plans(id),
  amount integer not null check (amount between 0 and 1000000000),
  days integer not null check (days between 1 and 1095),
  method text not null check (method in ('transfer', 'qris', 'ewallet', 'cash', 'other')),
  reference text not null default '',
  paid_on date not null,
  note text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prev_paid_until timestamptz,
  recorded_at timestamptz not null default now(),
  recorded_by text not null,
  cancelled_at timestamptz,
  cancel_reason text,
  check (ends_at > starts_at),
  check ((cancelled_at is null) = (cancel_reason is null))
);
create index if not exists payments_account_idx on payments(account_id, recorded_at desc);
create index if not exists payments_paid_on_idx on payments(paid_on);

-- Free trial days given from the console.
create table if not exists account_grants (
  id uuid primary key,
  account_id uuid not null references accounts(id),
  days integer not null check (days between 1 and 60),
  reason text not null,
  prev_trial_ends_at timestamptz not null,
  new_trial_ends_at timestamptz not null,
  at timestamptz not null default now(),
  by text not null
);
create index if not exists account_grants_account_idx on account_grants(account_id, at desc);

-- Admin password sign-in (ADMIN_PASSWORD secret). Only the SHA-256 of the token is stored.
create table if not exists admin_sessions (
  token_hash text primary key,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

-- Sliding-window counters: admin login failures (per IP and global) and merchant daily posts.
create table if not exists rate_events (
  key text not null,
  at timestamptz not null
);
create index if not exists rate_events_key_at_idx on rate_events(key, at);

-- One row per merchant account per business date: totals only (no receipts, items, customers or staff).
create table if not exists merchant_daily (
  account_id uuid not null references accounts(id),
  business_date date not null,
  transactions integer not null,
  gross bigint not null,
  discounts bigint not null,
  refunds bigint not null,
  net bigint not null,
  void_count integer not null,
  void_amount bigint not null,
  items_sold numeric not null,
  cash_tx integer not null default 0, cash_gross bigint not null default 0, cash_refunds bigint not null default 0,
  qris_tx integer not null default 0, qris_gross bigint not null default 0, qris_refunds bigint not null default 0,
  transfer_tx integer not null default 0, transfer_gross bigint not null default 0, transfer_refunds bigint not null default 0,
  ewallet_tx integer not null default 0, ewallet_gross bigint not null default 0, ewallet_refunds bigint not null default 0,
  other_tx integer not null default 0, other_gross bigint not null default 0, other_refunds bigint not null default 0,
  modes jsonb not null default '[]'::jsonb,
  hours jsonb not null default '[]'::jsonb,
  app_version text not null default '',
  computed_at timestamptz not null,
  received_at timestamptz not null,
  primary key (account_id, business_date)
);
create index if not exists merchant_daily_date_idx on merchant_daily(business_date);

alter table campaigns add column if not exists show_on_register boolean not null default false;

-- Landing page text edited in the console. One row; missing = the built-in text in the page.
create table if not exists site_content (
  id integer primary key check (id = 1),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

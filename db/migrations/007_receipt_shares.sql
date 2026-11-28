-- v0.21 send receipts (ADR-028). Neon Postgres. Run after 006.
-- A receipt the cashier shared by WhatsApp or email: the device's formatted copy and its PNG, opened at /r/<token>.
-- Rows expire after 90 days and are deleted on a later share.

create table if not exists receipt_shares (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{22}$'),
  account_id uuid not null references accounts(id),
  order_id uuid not null,
  doc jsonb not null,
  image_b64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists receipt_shares_expires_idx on receipt_shares(expires_at);

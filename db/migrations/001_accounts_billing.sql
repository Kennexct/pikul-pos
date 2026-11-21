-- v0.14 accounts and trial (ADR-013). Neon Postgres. Payments were removed with Midtrans (ADR-015).
create table if not exists accounts (
  id uuid primary key,
  email text not null unique check (email = lower(email)),
  google_sub text unique,
  created_at timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  paid_until timestamptz
);

create table if not exists login_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null
);

create table if not exists refresh_tokens (
  token_hash text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists refresh_tokens_account_idx on refresh_tokens(account_id);

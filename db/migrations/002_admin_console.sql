-- v0.15 admin console: plans, promo campaigns, admin audit (ADR-014). Neon Postgres. Run after 001.
create table if not exists plans (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,23}$'),
  name text not null,
  amount integer not null check (amount between 1000 and 100000000),
  days integer not null check (days between 1 and 1095),
  note text not null default '',
  badge text not null default '',
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed = the v0.14 placeholder plans. Change them in /admin, not here.
insert into plans (id, name, amount, days, note, badge, features, sort) values
  ('monthly', 'Bulanan', 49000, 30, 'Lanjut setelah masa coba. Bayar dengan QRIS, VA, GoPay, atau ShopeePay.', '',
   '["Semua fitur di masa coba", "Perpanjang kapan saja, tanpa hari hilang", "Data tetap milik Anda"]', 10),
  ('yearly', 'Tahunan', 490000, 365, 'Hemat dua bulan dibanding bayar bulanan.', 'Hemat 2 bulan',
   '["Semua fitur di masa coba", "Sekali bayar untuk setahun", "Data tetap milik Anda"]', 20)
on conflict (id) do nothing;

create table if not exists campaigns (
  id uuid primary key,
  name text not null,
  title text not null,
  body text not null default '',
  image_url text,
  link_url text,
  cta_label text not null default '',
  show_on_landing boolean not null default true,
  show_in_app boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  enabled boolean not null default false,
  archived boolean not null default false,
  plan_id text references plans(id),
  promo_amount integer check (promo_amount is null or promo_amount >= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((plan_id is null) = (promo_amount is null))
);
create index if not exists campaigns_live_idx on campaigns(starts_at desc) where not archived;

-- Uploaded banner images (PNG/JPEG/WebP, <= 500 KB), served at /api/public/images/<id>. R2 can replace this later.
create table if not exists images (
  id uuid primary key,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  data_b64 text not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  email text not null,
  action text not null,
  target text not null,
  detail jsonb
);

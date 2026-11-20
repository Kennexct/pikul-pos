-- Pikul initial schema
-- Principles:
--   * every row is scoped by store_id and protected by RLS
--   * ids are client-generated UUIDv7 (offline-first) -> upserts are idempotent
--   * money is integer rupiah (bigint)
--   * orders/refunds are append-only: no DELETE policy, line items frozen once paid

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Stores and membership
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  name text not null check (char_length(name) between 1 and 80),
  address text not null default '',
  phone text not null default '',
  logo_url text,
  timezone text not null default 'Asia/Jakarta'
    check (timezone in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
  day_cutoff time not null default '00:00',
  receipt_header text not null default '',
  receipt_footer text not null default 'Terima kasih!',
  receipt_paper_mm smallint not null default 58 check (receipt_paper_mm in (58, 80)),
  tax_pct numeric(5, 2) not null default 0 check (tax_pct between 0 and 100),
  service_pct numeric(5, 2) not null default 0 check (service_pct between 0 and 100),
  is_tax_inclusive boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_members (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid references auth.users (id),
  role text not null check (role in ('owner', 'cashier')),
  display_name text not null,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.store_members (store_id);
create index on public.store_members (user_id);

-- Helper functions used by RLS (security definer avoids recursive policy checks).
create or replace function public.is_store_member(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stores s where s.id = p_store_id and s.owner_id = auth.uid()
  ) or exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id and m.user_id = auth.uid() and m.deleted_at is null
  );
$$;

create or replace function public.is_store_owner(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores s where s.id = p_store_id and s.owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Catalog and configuration (owner writes, members read)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.variant_groups (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  is_required boolean not null default false,
  select_type text not null default 'single' check (select_type in ('single', 'multi')),
  min int not null default 0,
  max int not null default 1,
  options jsonb not null default '[]'::jsonb, -- [{id,name,priceDelta,sortOrder}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (min >= 0 and max >= min)
);

create table public.sales_modes (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  price_rule text not null default 'none' check (price_rule in ('none', 'mode_price', 'markup')),
  markup_pct numeric(5, 2) not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.products (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id),
  name text not null check (char_length(name) between 1 and 80),
  base_price bigint not null check (base_price >= 0),
  photo_url text,
  sku text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  variant_group_ids jsonb not null default '[]'::jsonb,
  mode_prices jsonb not null default '{}'::jsonb, -- {salesModeId: price}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.products (store_id, is_active);

create table public.payment_methods (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'qris', 'transfer', 'ewallet', 'other')),
  reference_mode text not null default 'off' check (reference_mode in ('off', 'optional', 'required')),
  reference_label text not null default '',
  qris_image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.discounts (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('item', 'order')),
  type text not null check (type in ('percent', 'fixed')),
  value bigint not null check (value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (type <> 'percent' or value <= 100)
);

-- ---------------------------------------------------------------------------
-- Operational data (members write)
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text check (phone is null or phone ~ '^(\+62|0)8[0-9]{7,12}$'),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.customers (store_id, name);
create index on public.customers (store_id, phone);

create table public.orders (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  receipt_no text not null,
  status text not null check (status in ('open', 'paid', 'void', 'refunded', 'partial_refund', 'cancelled')),
  sales_mode_id uuid not null,
  sales_mode_name_snapshot text not null,
  customer_id uuid references public.customers (id),
  label text not null default '',
  items jsonb not null default '[]'::jsonb,       -- OrderItem[] snapshot
  order_discount jsonb,                          -- AppliedDiscount | null
  payments jsonb not null default '[]'::jsonb,    -- OrderPayment[]
  totals jsonb not null,                         -- OrderTotals
  grand_total bigint generated always as ((totals ->> 'grandTotal')::bigint) stored,
  cashier_id uuid not null,
  business_date date not null,
  opened_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (store_id, receipt_no)
);
create index on public.orders (store_id, business_date);
create index on public.orders (store_id, status);

create table public.refunds (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid not null references public.orders (id),
  kind text not null check (kind in ('void', 'refund')),
  amount bigint not null check (amount > 0),
  items jsonb not null default '[]'::jsonb,
  reason_code text not null check (reason_code in ('wrong_input', 'customer_cancel', 'out_of_stock', 'other')),
  reason_note text not null default '',
  actor_id uuid not null,
  approved_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.refunds (store_id, order_id);

create table public.audit_events (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.audit_events (store_id, created_at desc);

-- A paid/void/refunded order's lines and totals can never be edited; only status moves forward.
create or replace function public.guard_order_immutability()
returns trigger language plpgsql as $$
begin
  if old.status <> 'open' and (
    new.items is distinct from old.items or
    new.totals is distinct from old.totals or
    new.payments is distinct from old.payments
  ) then
    raise exception 'Order % is %, its items/totals/payments are immutable', old.receipt_no, old.status;
  end if;
  return new;
end;
$$;

create trigger orders_immutability before update on public.orders
  for each row execute function public.guard_order_immutability();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;
create policy stores_select on public.stores for select using (public.is_store_member(id));
create policy stores_insert on public.stores for insert with check (owner_id = auth.uid());
create policy stores_update on public.stores for update using (owner_id = auth.uid());

do $$
declare
  t text;
begin
  -- Owner-managed configuration tables.
  foreach t in array array['store_members', 'categories', 'variant_groups', 'sales_modes', 'products',
                           'payment_methods', 'discounts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_select on public.%1$I for select using (public.is_store_member(store_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert with check (public.is_store_owner(store_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update using (public.is_store_owner(store_id))', t);
  end loop;

  -- Operational tables any member writes (append-only: no delete policy).
  foreach t in array array['customers', 'orders', 'refunds', 'audit_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_select on public.%1$I for select using (public.is_store_member(store_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert with check (public.is_store_member(store_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update using (public.is_store_member(store_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reporting views (security_invoker -> RLS of the caller applies)
-- ---------------------------------------------------------------------------
create view public.order_lines with (security_invoker = true) as
select
  o.store_id,
  o.id as order_id,
  o.business_date,
  o.status,
  o.sales_mode_name_snapshot as sales_mode,
  (line ->> 'productId')::uuid as product_id,
  line ->> 'nameSnapshot' as product_name,
  (line ->> 'qty')::int as qty,
  (line ->> 'unitPrice')::bigint * (line ->> 'qty')::int as gross
from public.orders o
cross join lateral jsonb_array_elements(o.items) as line
where o.deleted_at is null;

create view public.daily_sales with (security_invoker = true) as
select
  o.store_id,
  o.business_date,
  count(*) filter (where o.status in ('paid', 'refunded', 'partial_refund')) as transactions,
  coalesce(sum(o.grand_total) filter (where o.status in ('paid', 'refunded', 'partial_refund')), 0) as gross_sales,
  coalesce(sum(r.refund_total), 0) as refunds,
  coalesce(sum(o.grand_total) filter (where o.status in ('paid', 'refunded', 'partial_refund')), 0)
    - coalesce(sum(r.refund_total), 0) as net_sales
from public.orders o
left join lateral (
  select sum(amount) as refund_total from public.refunds rf where rf.order_id = o.id and rf.kind = 'refund'
) r on true
where o.deleted_at is null
group by o.store_id, o.business_date;

-- ---------------------------------------------------------------------------
-- Storage: product photos and static QRIS images, path = <store_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-photos', 'product-photos', true, 262144, array['image/webp', 'image/jpeg', 'image/png']),
  ('qris', 'qris', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy storage_owner_write on storage.objects for insert
  with check (
    bucket_id in ('product-photos', 'qris')
    and public.is_store_owner(((storage.foldername(name))[1])::uuid)
  );

create policy storage_owner_update on storage.objects for update
  using (
    bucket_id in ('product-photos', 'qris')
    and public.is_store_owner(((storage.foldername(name))[1])::uuid)
  );

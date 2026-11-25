-- v0.19.7 recognisable devices. Neon Postgres. Run after 005.
-- Each device reports its browser and system ("Chrome · Android") and whether it runs in a private window,
-- so the owner can tell devices apart in Pengaturan → Sinkronisasi and remove old incognito ones.

alter table sync_devices add column if not exists auto_name text not null default '';
alter table sync_devices add column if not exists private_mode boolean not null default false;

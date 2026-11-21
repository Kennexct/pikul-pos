# CTO — index

[DISCOVERED] Offline-first PWA for Indonesian UMKM / street-food sellers. Stack: React 19 + TypeScript + Vite 8 PWA, Tailwind v4, Zustand, Dexie (IndexedDB); Supabase (Postgres/Auth/Storage, ap-southeast-1) as sync backend; Vercel hosting.
[DISCOVERED] Build-vs-buy: build (existing POS apps too heavy/expensive for kaki lima segment — see PRD).
[DISCOVERED] Cost target: ≤ Rp1.000 per active merchant/month at 10k merchants.

## Features
- pos-core (M1–M9, M14 partial) — shipped v0.2/v0.3
- sales-history-refunds (M10–M11) — shipped v0.4
- reports-export (M12–M13) — **delivered** (branch `feat/reports-export`) → `reports-export.md`
- staff-pin (M15 part 1) — build offline, WebCrypto, client-side limit accepted → `staff-pin.md`
- v0.8–v0.13 feedback rounds — all on-device, ADR-006…012
- accounts-billing (v0.14) — paid product: 14-day trial then Midtrans subscription → `accounts-billing.md`

## Stack update (2026-11-20, ADR-013)
Backend and hosting are now Cloudflare Pages + Functions, Neon Postgres, Resend, Midtrans; R2 reserved for cloud backup. The Supabase + Vercel lines above are superseded.
- admin-console-revamp (v0.17) — business console, daily totals always on, build not buy → `admin-console-revamp.md`

- vercel-neon-launch (v0.18) — ADR-022, ADR-023 → `vercel-neon-launch.md`

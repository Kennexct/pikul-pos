# Architect — index

[DISCOVERED] Offline-first: UI reads/writes only Dexie; `saveAndQueue` writes record + outbox row in one IDB transaction; `pushOutbox` upserts by client UUIDv7 (idempotent).
[DISCOVERED] Orders append-only with immutability trigger server-side; refunds/voids are linked records + audit events.
[DISCOVERED] Pure domain logic in `src/lib/*` (pricing, refunds, dateRange, salesSummary) — unit tested; services in `src/services/*`; UI in `src/pages/*`.
[DISCOVERED] Business date = store timezone + day cut-off (`lib/businessDate.ts`).
[DISCOVERED] Known gap: sync is push-only (no pull to other devices yet — M15).

## Features
- admin-console (v0.15) — ADR-014, ADR-015 → `admin-console.md`
- reports-export — ADR-001, ADR-002 → `reports-export.md`
- staff-pin — ADR-003, ADR-004 → `staff-pin.md`
- customers (M7) — ADR-005 → `customers.md`
- v0.8 feedback batch — ADR-006 → `v08-feedback.md`
- v0.9 profit, expenses, close of day, backup — ADR-007, ADR-008 → `v09-profit-closing-backup.md`
- v0.10 first-time journey, help centre — ADR-009 → `v10-onboarding-help.md`
- v0.11 English — ADR-010 (source-string dictionary, reload on change)
- v0.12 flexible price, sell by weight — ADR-011 → `v12-flex-price-weight.md`
- v0.13 variants + add-on rename — ADR-012 → `v13-variants-addons.md`
- v0.14 accounts, trial, billing — ADR-013 → `accounts-billing.md`; landing page → `landing-page.md`
- rebrand to Pikul — ADR-016 → `rebrand-pikul.md`

## Update 2026-11-20
- Server code lives in `server/` (framework-free, `Deps` injection); `functions/api/[[path]].ts` only wires Cloudflare env.
- Entitlement is decided on device from a signed ES256 access pass (active / grace 3 days / expired → read-only enforced in order services).
- The outbox push still targets the legacy Supabase client and is inert without env; multi-device sync must be redesigned on Neon (new ADR).
- register-categories (v0.16) — ADR-017 → `register-categories.md`
- admin-console-revamp (v0.17) — ADR-020 → `admin-console-revamp.md`

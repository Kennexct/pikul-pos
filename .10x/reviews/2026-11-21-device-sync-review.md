# Review — device-sync (v0.19.0), 2026-11-21

## QA — PASS
| Check | Result |
|---|---|
| `npm run typecheck` (app, server, Vercel adapter) | pass |
| `npm run i18n:check` | 1454 keys, 0 missing, 0 unused |
| `npm test` | 251 passed (48 files) |
| `npm run build:vercel` | pass, function 355 KB |
| e2e `v19.py` (two/three devices, one account) on Vercel output, phone + tablet | pass |
| e2e `v18.py`, `v17.py` on Vercel output | pass |
| e2e `flow.py`, `staff.py`, `v09.py`, `v16.py`, `customers.py` (billing off, base `/app`) | pass, no console/network errors |
| e2e `history.py` | stops at the Void step, same as before this branch (unrelated) |
| `db/neon-setup.sql` on Postgres 17 (PGlite), run twice + every `neonSyncRepo` query | pass, 16 tables |

Bug found and fixed in review: offline-only builds called `/api/sync/devices` (404) from Kas and Settings → `refreshDevices()` now stays local without a sync binding.

## Security — PASS (see decisions/security/device-sync.md)
Account isolation by bearer + bound store, allow-listed tables, UUID ids, size caps, password + rate limit + backup on "replace". No secrets added to the client. Residual: server can read store data (no E2E encryption).

## Not verified here
Real Vercel + Neon over HTTP (runbook "Device sync" steps on the live site), and two real phones on a flaky network.

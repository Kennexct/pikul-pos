# QA — device-sync (v0.19)
- Unit: 251 tests pass (server sync handlers, two-device round trip through the real router, LWW, final status never reverts, per-device cash, devices day). PGlite run of `neon-setup.sql` (twice) + every `neonSyncRepo` query: pass.
- e2e `v19.py` phone + tablet: pass (A uploads; B signs in → cashier with menu + A's sale, own register closed, Semua perangkat; B renames store → A; C offline → own store → choice → Pakai toko dari akun with backup download).
- Regression: v18, v17 (Vercel output) pass; flow, staff, v09, v16, customers (offline-only build, base `/app`) pass with no errors after the `refreshDevices` fix. `history.py` stops at the Void step as before this branch (known, unrelated).
Report: `reviews/2026-11-21-device-sync-review.md`.

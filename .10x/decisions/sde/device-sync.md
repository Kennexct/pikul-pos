# SDE — device-sync (v0.19, ADR-025 / ADR-026)

What was built:
- Server: `server/sync.ts` (handlers), `syncCheck.ts` (limits, validation, LWW + final-status guard), `syncTypes.ts`, `memorySyncRepo.ts`, `neonSyncRepo.ts`; routes `/api/sync/{store,claim,push,pull,replace,devices,devices/name}` in `router.ts`; request body cap 4.1 MB in `vercel.ts` (push only; other routes keep their own limits via `bodyLimit()`).
- Client: `services/device.ts` (device id + receipt code), `services/sync.ts` (outbox push in batches ≤100 / ~3.5 MB, cursor pull, LWW apply, one run at a time + one queued rerun), `services/syncBinding.ts` (boot decision, claim, device list cache), `services/storeSwitch.ts` (download, backup + wipe, keep this device's store with password), `hooks/useBootstrap.ts` + `pages/Onboarding/StoreSyncScreens.tsx` (Mengunduh, Perlu internet, store choice, other account), Settings → Sinkronisasi, Kas → Semua perangkat (`lib/devicesDay.ts`, `AllDevicesCard.tsx`).
- Register per device: `deviceId` stamped on orders, refunds, expenses, day closings; Dexie v5 stamps legacy rows; opening cash stays device-local.
- Removed the dead Supabase client and dependency.

Deviations from plan:
- `refreshDevices()` returns the cached list when the device has no sync binding (found by the offline regression: offline-only builds were calling `/api/sync/devices`).
- DailyTotals notice text changed (data now does leave the device) → key bumped to `kk.dailyTotalsNotice.v2`.

Tech debt:
- No deletes are synced (the app has none for synced tables: records are deactivated, orders append-only). If hard deletes are ever added, add tombstones.
- Product photos travel inside product records (base64); a 1.5 MB per-record cap protects the server. Move photos to R2/Blob when they grow.

# Architect — device-sync (v0.19) — ADR-024, ADR-025
Components:
- Server `server/sync.ts` (handlers: store, claim, push, pull, replace, devices, device name), `server/syncCheck.ts` (validation, LWW decision), `SyncRepo` in `server/syncTypes.ts`, implemented by `memorySyncRepo.ts` and `neonSyncRepo.ts`. Router body limit 4 MB for `/api/sync/push`.
- DB `db/migrations/005_device_sync.sql`: `account_store`, `sync_records`, `sync_devices`, `sync_seq`.
- Device `src/services/sync.ts` (outbox + push + pull + apply), `src/services/syncApi.ts` (HTTP), `src/services/syncBinding.ts` (decide binding on boot, claim, download, adopt/replace with backup), `src/services/device.ts` (deviceId, receipt code, device names cache).
- Boot: `useBootstrap` gains states `downloading`, `choose`, `needOnline`; `useOnlineStatus` runs the sync loop.
- UI: `pages/Onboarding/StoreChoicePage.tsx`, `DownloadingScreen`, Settings → `SyncSettings.tsx`, Kas → `AllDevicesCard.tsx`.
Data flow: write → Dexie + outbox (unchanged) → push batch → server LWW upsert, seq → other device pull(after cursor) → LWW apply → liveQuery re-renders.
Failure modes: offline (queue grows, UI unchanged), 401 (pause), 409 store_mismatch (choice screen), 413/400 per record (mark entry, skip), 5xx (retry next tick).

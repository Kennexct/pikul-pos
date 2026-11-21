# EM — device-sync (v0.19) plan
| # | Task | Depends |
|---|---|---|
| S1 | Migration 005 + neon-setup regenerate + dbSetup test | — |
| S2 | Server SyncRepo (memory + neon), handlers, router, tests | S1 |
| C1 | device.ts (deviceId, receipt code), SyncMeta.deviceId, Dexie v5 stamp, stores in sync list, updateStore queues | — |
| C2 | Client sync engine (push/pull/apply), remove Supabase, sync loop | S2, C1 |
| C3 | Binding on boot: download, claim, choice screen with backup files, needOnline, prefill from profile | C2 |
| C4 | Cash per device + "Semua perangkat" card | C1 |
| C5 | Settings → Sinkronisasi (status, sync now, device names) | C2 |
| C6 | i18n, help/privacy text, e2e v19 (two contexts), runbook, version 0.19.0 | all |
Risks: Vercel body limits (batch by bytes), Dexie upgrade on large stores (modify in one pass), e2e needs two browser contexts against `scripts/vercel-local.mjs`.

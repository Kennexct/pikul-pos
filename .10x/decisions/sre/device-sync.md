# SRE — device-sync (v0.19)
- Selling never waits for sync; failures show "Sinkronisasi tertunda. Data aman di perangkat." and retry every 15 s online.
- Load: each online device pulls every 15 s (one indexed query on `(account_id, seq)`), pushes only when the outbox has rows. Pull pages 500 rows, 40 pages per run.
- Signals: Vercel logs `api_error` on `/api/sync/*`; Neon storage growth of `sync_records`; Settings shows pending and rejected counts per device.
- Incident: stuck device → Pengaturan → Sinkronisasi → Sinkronkan sekarang; still stuck → backup file from that device.

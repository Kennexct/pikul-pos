# CTO — device-sync (v0.19)
- Build, not buy: Firebase/PowerSync/ElectricSQL would replace Dexie or add a second backend; we already have Neon + Vercel functions + an outbox. A generic record relay is ~1 week of work.
- Strategic: sync unlocks multi-device stores, the merchant back-office and per-merchant admin reports (status.md "after device sync").
- Cost: Neon storage grows ~1–3 KB per order; fine on the free/launch tier for the first thousands of merchants. Revisit (archive old records or R2 photos) at 1 GB.

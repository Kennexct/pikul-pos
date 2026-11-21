# admin-console-revamp (v0.17) — CTO
- **Problem:** Kenny runs Pikul as a subscription business but has no way to see merchants, record payments (Midtrans removed, ADR-015) or know how merchants use the app. Extending an account today means SQL in Neon.
- **Build vs buy:** build. The data (accounts, plans, campaigns) already lives in our Neon; a BI tool (Metabase, Looker Studio) would need a DB connection with merchant emails and no write actions (payments, grants). Kept as an option later for ad-hoc analysis on a read-only role.
- **Direction:** business console first; merchant back-office (owner views own store remotely) waits for multi-device sync.
- **Merchant data:** daily totals per store, always on (Kenny's decision 2026-11-21), disclosed in the app and the terms. Totals only — the server never receives orders, items, customers or staff. This keeps the "your data stays on your device" promise true for business detail.
- **Cost:** one row per merchant per day (~1 KB). 10k merchants × 365 days ≈ 3.6 GB-year worst case; within Neon paid tiers. Add retention (keep 400 days) later if needed.
- **Risk accepted:** single shared admin password (no per-person accounts) until there is more than one operator.

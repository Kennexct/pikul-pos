# Security — device-sync (v0.19, ADR-024)
- AuthN: every sync route needs the merchant bearer (refresh token); account comes from the token, never the body.
- AuthZ / isolation: all queries keyed by `account_id`; `storeId` in each request must equal the account's bound store (else 409). Tests: another account cannot pull or push into a store.
- Input: tables allow-listed, ids must be UUIDs and equal `data.id`, record ≤1.5 MB, ≤100 records, body ≤4 MB; device name cleaned (1–30 chars, no control chars).
- Destructive replace needs the account password, rate-limited 5/hour, and the client saves a backup file of the server store first.
- Data at rest: store data (incl. customer names/phones) now lives in Neon; privacy text in the daily-totals notice and Help updated. No secrets in the client.
Residual: no end-to-end encryption (server can read store data); acceptable for UMKM, revisit if requested.

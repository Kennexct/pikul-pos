# Security — index

[DISCOVERED] Only anon key in client; RLS per store_id; append-only operational tables; audit events for cancel/void/refund.
[DISCOVERED] Known limitation: shared device signs in as owner; cashier role enforcement is app-level until M15.

## Features
- admin-console (v0.15) — ADR-014, ADR-015 → `admin-console.md`
- reports-export — PASS, formula-injection guard → `reports-export.md`
- staff-pin — PASS with documented limits → `staff-pin.md`
- customers — PASS; first PII, ADR-005 → `reviews/2026-11-18-customers-review.md`
- accounts-billing (v0.14) — see `accounts-billing.md`; open: rate limit on `/api/auth/code`, CSP header

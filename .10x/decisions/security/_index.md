# Security — index

[DISCOVERED] Only anon key in client; RLS per store_id; append-only operational tables; audit events for cancel/void/refund.
[DISCOVERED] Known limitation: shared device signs in as owner; cashier role enforcement is app-level until M15.

## Features
- admin-console (v0.15) — ADR-014, ADR-015 → `admin-console.md`
- reports-export — PASS, formula-injection guard → `reports-export.md`
- staff-pin — PASS with documented limits → `staff-pin.md`
- customers — PASS; first PII, ADR-005 → `reviews/2026-11-18-customers-review.md`
- accounts-billing (v0.14) — see `accounts-billing.md`; open: rate limit on `/api/auth/code`, CSP header
- rebrand-pikul → `rebrand-pikul.md` (PASS)
- register-categories (v0.16) — ADR-017 → `register-categories.md`
- admin-console-revamp.md — v0.17 business console (ADR-020)
- `admin-sidebar-nav` — admin console left sidebar (ADR-021)

- vercel-neon-launch (v0.18) — ADR-022, ADR-023 → `vercel-neon-launch.md`
- `admin-click-to-edit` — read-only-first landing + plan editors (ADR-024) → `admin-click-to-edit.md`

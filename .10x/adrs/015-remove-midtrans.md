# ADR-015: Remove Midtrans; no online payment for now

**Status:** Accepted
**Date:** 2026-11-20
**Feature:** admin-console (follow-up)
**Author:** 10x-Team (Architect)

## Context
Kenny asked to remove Midtrans completely, from the code and the docs, before going further. Nothing was deployed, so no live payments or Midtrans data exist.

## Decision
- Removed: `server/midtrans.ts`, `POST /api/billing/checkout`, `POST /api/billing/midtrans`, `GET /api/billing/status/:id`, the `payments` table and repo methods, `MIDTRANS_*` variables, the app's pay buttons and payment history, and every Midtrans mention in the landing page, README, runbooks and project records in use.
- Kept: accounts, the 14-day trial, the offline access pass and `accounts.paid_until` (entitlement beyond the trial). `GET /api/billing` now returns the account and the plans only.
- Plans and campaign promo prices (ADR-014) are display prices on the landing page and in the app.
- Migration `001` no longer creates `payments` (never applied anywhere); `002` no longer alters it.

## Consequences
- A trial cannot be extended from the app. Until a provider is chosen, extend an account in Neon (`update accounts set paid_until = …`) — runbook `deploy-cloudflare.md`.
- The expired banner still says "Perpanjang"; it opens Langganan, which shows the plans and "Pembayaran online segera hadir."
- Adding a provider later needs a new ADR: a payments table with a plan/amount/days snapshot, server-side price from `priceNow()` (already in `server/catalog.ts`), and a verified notification.

## Supersedes
The billing part of ADR-013 (Midtrans Snap redirect, notification, payments).

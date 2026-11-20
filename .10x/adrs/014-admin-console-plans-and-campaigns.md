# ADR-014: Admin console, plans in the database, scheduled promo campaigns

**Status:** Accepted
**Date:** 2026-11-20
**Feature:** admin-console
**Author:** 10x-Team (Architect + Security)

## Context
Plan prices were a constant in `server/types.ts` and hard-coded in the landing page and the app (Rp49.000 / Rp490.000 placeholders). Kenny wants to set plans himself and run promo pop-ups on the landing page without a code change or a deploy.

## Decision
- **Plans and campaigns live in Neon** (`plans`, `campaigns`, `admin_audit`; migration `002_admin_console.sql`). `server/catalog.ts` holds the pure rules: validation, "is live", effective price, which pop-up to show.
- **Price is decided on the server at checkout** from the plan row and the live campaigns. The payment row snapshots plan name, amount, days and campaign; `applyPaid` extends by the snapshot's days.
- **Admin = allow-listed email** (`ADMIN_EMAILS` secret) on top of the existing email-code sign-in, plus a 12-hour freshness rule on the session used for admin calls. No new auth system.
- **Console is a third Vite entry** (`/admin/`, `src/admin/`), reusing the design system, excluded from the PWA precache.
- **Landing reads live data at runtime** from `GET /api/public/landing` (public, edge-cached 60 s). The static HTML keeps fallback prices.

## Alternatives Considered
| Alternative | Why not |
|---|---|
| Rebuild static landing on publish (deploy hook) | Needs a build per change and a Cloudflare API token in the function; minutes instead of seconds |
| Cloudflare Access as the only gate | Good extra layer, but adds a Zero Trust setup step before Kenny can use it; kept optional |
| Admin inside the POS PWA | Ships admin code to every merchant device and into the offline cache |
| Campaign as message only | A "diskon" pop-up that still charges full price misleads buyers |

## Consequences
- Prices can change without a deploy; pending payments keep their snapshot amount, so Midtrans notifications still match.
- The landing page depends on the API for current prices; when it is down, the static fallback shows (may be stale).
- A stolen admin refresh token is only useful for 12 hours from issue for admin calls.

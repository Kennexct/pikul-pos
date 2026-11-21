# admin-console-revamp (v0.17) — Engineering Manager
One branch `feat/admin-console-revamp` (on `feat/admin-no-signin`). Commit per task; state update per release.

## Release A — sign-in, merchants, payments
- A1 Migration 003, types, repo split (`CoreRepo & AdminRepo`), memory + Neon admin repos, `last_seen_at` touch on sign-in/refresh
- A2 `adminAuth.ts` (login, lockout, sessions, logout) + router context `{ip, query}`; remove ADMIN_EMAILS/ADMIN_OPEN; tests
- A3 `ledger.ts` pure maths + `merchants.ts` handlers (overview, list, detail, payment record/cancel, grant, payments list/CSV); tests
- A4 Console: login screen, tab shell, Ringkasan, Merchant list + detail + forms, Pembayaran; api client + preview data; i18n
## Release B — daily totals + reports
- B1 `lib/dailyTotals.ts` (Report → row) + `services/dailyTotals.ts` (Dexie load, post, triggers) + disclosure sheet; tests
- B2 Server `daily.ts` validation + upsert + rate limit; repo aggregates; tests
- B3 `analytics.ts` + report endpoint + merchant summary endpoint; tests
- B4 Console: Laporan tab, merchant summary in detail, Ringkasan additions
## Release C — content + register pop-up
- C1 `landing/content.json` defaults, build.py reads it with `data-lp` hooks, `siteContent.ts`, endpoints, `live.ts` apply; tests
- C2 Console Konten landing tab
- C3 `show_on_register` placement: server, campaign form, app cache + RegisterPopup after open register; tests
## Finish
- QA: typecheck, i18n, unit, build, e2e (phone + tablet) for admin + app flows; security review; runbook `docs/runbooks/admin-console.md`; version 0.17.0; bundle + patches + screenshots to project folder.
## Risks
- No real Neon here: SQL is exercised only by review + Neon-specific care; memory repo covers logic. Mitigation: keep SQL simple, document a smoke test in the runbook.
- Wrangler not installed for e2e of functions (v14/v15 precedent): run the console e2e against a local Node harness of `route()` + memoryRepo if wrangler is missing.

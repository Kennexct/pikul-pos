# admin-console-revamp (v0.17) — Product Manager
Spec: `specs/2026-11-21-admin-console-revamp-design.md`. User: Kenny (operator, phone + laptop).

## Stories
1. As the operator I sign in with one password and stay signed in for 12 hours.
2. I see on one screen how many merchants are paying, on trial, expired, new, and who to contact today.
3. I find a merchant by email and see their plan, status, active-until, last active and total paid.
4. I record a manual payment (plan, amount, method, reference, date) and the merchant's app gets the new end date on its next online refresh.
5. I cancel a wrong payment with a reason; the record stays.
6. I give free trial days with a reason.
7. I see each merchant's executive summary (transactions, value, payment types, sales modes, trend) — never their receipts or menu, and I can't log in as them.
8. I see an executive report for Pikul (sign-ups, paying, revenue, conversion, churn) and for all merchants together (volume, mix, busy hours/days, top merchants), by date range, and export CSV.
9. I edit landing hero text, feature list and FAQ, and they appear within about a minute.
10. I run a pop-up campaign shown the first time a merchant opens the register each day.

## Success criteria
- No SQL needed to extend an account.
- Executive numbers for a merchant equal the merchant's own Laporan totals for the same dates (same `buildReport`).
- Selling offline is never affected (no network on the sell path).
- Releases A, B, C each pass typecheck, i18n, unit tests, build and e2e on phone + tablet.

## Out of scope
Merchant back-office, WhatsApp/store name, online payment, bulk email, multiple admins, item-level cross-merchant analytics.

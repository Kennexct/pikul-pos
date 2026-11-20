# SDE — index (what exists)

[DISCOVERED] v0.2: POS checkout, variants, mode pricing, discounts, payment + static QRIS, open orders, receipt, products/settings.
[DISCOVERED] v0.3: design system redesign (Plus Jakarta Sans, pandan green tokens, logo, components).
[DISCOVERED] v0.4: sales history, void, refund (`services/refunds.ts`, `lib/refunds.ts`, `pages/History/`).
[DISCOVERED] Tests: 44 unit/integration (vitest), 3 e2e flows. Tech debt: photos/QRIS stored as data URLs (Storage upload pending); cashier PIN approval pending M15.

## Features
- reports-export — built T1–T7 → `reports-export.md`
- staff-pin — built T1–T8 → `staff-pin.md`
- customers (M7) → `customers.md`
- v0.8 feedback round (custom methods/modes, sold-out, debt) → `v08-feedback.md`
- v0.9 profit, expenses, close of day, backup → `v09-profit-closing-backup.md`
- v0.10 first-time journey, help centre → `v10-onboarding-help.md`
- v0.11 English → `v11-english.md`
- v0.12 flexible price, sell by weight → `v12-flex-price-weight.md`
- v0.13 variants + add-on rename → `v13-variants-addons.md`
- v0.14 accounts, trial, billing → `accounts-billing.md` (160 unit tests, `e2e/v14.py`)

# QA — register-categories
- Unit: 176 pass (+11: register status, denominations, opening audit, category create/rename/move/delete).
- e2e `v16.py` phone 390×844 + tablet 1024×768: 24 checks pass — gate on first tap, counter fills amount, open toast, Kas expected Rp115.000, close with count short Rp5.000, closed-day warn once and never block, category add/duplicate refused/rename/move/delete → 2 products to Tanpa kategori, variant expand (5 lines, prices, aria-expanded, collapse, expand all).
- Regression: flow, manage, history, staff, customers, v08–v13, reports all pass on phone + tablet. v14/v15 need `wrangler pages dev` + Neon, not run here (v14 patched to open the register).
- Found pre-existing: `v08.py` and `reports.py` already failed on `feat/ui-polish` (sheet exit motion made selectors ambiguous / clicks land during animation). Fixed in the scripts.
- Manual still open: gate on a low-end Android (sheet with autofocus on numeric keypad), iPad Safari counter input.

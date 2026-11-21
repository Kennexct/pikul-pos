# QA — vercel-neon-launch
- Unit: 229 tests (new: signup.test.ts 12, vercel.test.ts 3, dbSetup.test.ts 2; server/admin/merchant/report tests moved to sign-up helper).
- e2e on the bundled Vercel output (`scripts/vercel-local.mjs`, DEV_MODE memory DB): v18 (sign-up incl. invalid WhatsApp, store name prefill, wrong password, forgot without email, admin list/search/sheet, temporary password, old password refused) PASS phone 390×844 + tablet 1024×768; v17 PASS phone + tablet.
- Regression (billing-off build): flow, v10, v16 PASS.
- SQL: neon-setup.sql runs twice cleanly on PGlite; neonRepo account queries verified.
- Not testable here: a real Vercel deploy (Build Output API routing on Vercel's edge) → runbook step 5 smoke tests.

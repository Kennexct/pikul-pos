# Browser flow checks (Playwright, Python)

```bash
npm run build && npx vite preview --port 4173 &
python3 -I e2e/flow.py   http://localhost:4173 ./shots              # sale on tablet + phone, cash + QRIS
python3 -I e2e/manage.py http://localhost:4173 ./shots e2e/fixtures # QRIS upload, new product, open order -> pay
python3 -I e2e/history.py http://localhost:4173 ./shots              # 2 sales -> partial refund + void -> totals
python3 -I e2e/staff.py   http://localhost:4173 ./shots              # owner PIN, cashier, switch seller, PIN-approved discount + void, gate, lockout
python3 -I e2e/customers.py http://localhost:4173 ./shots            # add customer, attach + quick-add at POS, receipt/WhatsApp, stats, delete
python3 -I e2e/v08.py     http://localhost:4173 ./shots              # add/rename/move/delete method + mode, sold-out, unpaid customers + reminder, history after removals
python3 -I e2e/v10.py     http://localhost:4173 ./shots              # first-time journey with a template, Langkah awal, help page + contextual help
python3    e2e/v13.py     http://localhost:4173 ./shots              # coffee shop: Kopi → variant → add-ons, takeaway per variant, sold-out variant, new product with variants, best sellers per variant
python3    e2e/v12.py     http://localhost:4173 ./shots              # market seller: weight setting, product per kg + flexible price, sell by weight / amount / changed price, refund, Excel (needs openpyxl)
python3    e2e/v11.py     http://localhost:4173 ./shots              # English device: whole app in English, leftover-Indonesian scan, Excel, switch language (needs openpyxl)
python3    e2e/v09.py     http://localhost:4173 ./shots              # cost price -> profit + Excel, expenses, close of day (short, reopen, exact), backup -> restore (needs openpyxl)
python3    e2e/reports.py http://localhost:4173 ./shots              # sales + refund -> Reports -> download XLSX/PDF/CSV and verify (needs openpyxl)
python3    e2e/v16.py     http://localhost:4173/app ./shots          # register: open with count before first sale, close with count, closed-day warning; Kategori tab; variant expand
```
Both print `ERRORS: none` when no page errors, console errors or failed requests occurred. Screenshots land in `./shots`.
Since v0.10 a fresh browser profile opens the first-time journey; every older flow presses "Lewati, pakai contoh toko" first.
Since v0.11 every Indonesian flow sets `locale='id-ID'` on the browser context; a default headless browser reports English and would open the app in English.

## v0.14: the app lives under /app
Old flows: build without `VITE_PASS_PUBLIC_JWK` (billing off), `npx vite preview --port 4173`, then pass `http://localhost:4173/app` as BASE.
`manage.py` takes the fixtures folder as a third argument: `python3 e2e/manage.py http://localhost:4173/app OUT e2e/fixtures`.
`v14.py` runs against `wrangler pages dev` — see docs/runbooks/deploy-cloudflare.md.

## v0.16: open the register first
Since v0.16 (ADR-017) the first sale of the day asks to open the register. Every older flow calls `open_register(page)` right after the first-time journey (it opens Kas, presses "Buka kasir" with the suggested float and goes back).

## v0.17: the store starts empty (ADR-018)
The first-time journey no longer offers example menus and "Lewati, pakai contoh toko" is now "Lewati" (empty store).
Flows that need something to sell use `e2e/sample_menu.py`: `skip_with_sample_menu(page)` presses Lewati and writes the bakso sample menu into IndexedDB; `add_sample_menu(page, 'kopi')` does the same after a full journey. The data is `fixtures/sample-menus.json`, a mirror of `src/test/sampleMenu.ts` (a unit test keeps them equal). `v10.py` also checks the empty-menu state.

## v0.18: Vercel output, sign-up with password (ADR-022, ADR-023)
Merchant accounts are created on the "Daftar" tab (owner, store, WhatsApp, city, email, password) and signed in with email + password; email codes are only for "Lupa kata sandi" when Resend is set. Helpers: `e2e/account.py` (`sign_up`, `sign_in`).
Account flows run against the Vercel output served locally:
```bash
node scripts/gen-pass-key.mjs > /tmp/keys.env && set -a && . /tmp/keys.env && set +a
npm run build:vercel
DEV_MODE=1 APP_ORIGIN=http://localhost:4173 ADMIN_PASSWORD=admin-kata-sandi-panjang node scripts/vercel-local.mjs 4173 > /tmp/api.log &
python3 e2e/v18.py http://localhost:4173 ./shots admin-kata-sandi-panjang              # sign-up, sign-in, forgot, admin merchant details, temporary password
python3 e2e/v19.py http://localhost:4173 ./shots                                       # device sync: A uploads, B downloads + register per device, store choice on C
python3 e2e/v17.py http://localhost:4173 ./shots /tmp/api.log admin-kata-sandi-panjang # admin console revamp (uses sign_up now)
```
Set `CHROME=/path/to/chrome` to pick the browser. `v14.py` and `v15.py` used email-code sign-in and the old admin email codes; they are superseded by `v18.py` and `v17.py`.

## v0.19.1: quicker product form
"Punya varian" is now the "Satu harga / Ada varian" control; per-variant Takeaway/cost sit under "Detail"; the three switches sit under "Pengaturan lain".
```bash
python3 e2e/v20.py http://localhost:4173/app ./shots   # pending category created on save, price replaces 0, save & add another, variants quick fill
```

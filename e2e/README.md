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

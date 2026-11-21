# Admin console (v0.17, ADR-020)

Open `https://<your-domain>/admin/` and type the admin password. The session lasts 12 hours in that tab; **Keluar** ends it. Five wrong passwords from one network (or 20 overall) lock sign-in for 15 minutes.

## Set up (once)
1. Neon SQL editor: run `db/migrations/003_admin_revamp.sql` (after 001 and 002).
2. Cloudflare Pages → Settings → Variables: add `ADMIN_PASSWORD` as an **encrypted** variable, at least 12 random characters (e.g. `openssl rand -base64 18`). Remove `ADMIN_EMAILS` and `ADMIN_OPEN`. Redeploy.
3. Smoke test: `/admin/` shows the password screen (not "Konsol belum aktif"); sign in; Ringkasan loads.
Change the password: edit the variable and redeploy (existing sessions stay valid until they expire; to end them now: `delete from admin_sessions;`).

## Tabs
- **Ringkasan**: money in this month vs last, paid / trial / expired counts, sign-ups, trial → paid conversion, merchant sales today and this week, and **Perlu dihubungi** (trial ending ≤ 3 days, subscription ending ≤ 7 days, just expired). Tap a merchant to open it.
- **Merchant**: plan cards (count per plan; tap to filter), search by email, status filters (Coba, Berbayar, Hampir habis, Kedaluwarsa, Tidak aktif). Opening a merchant shows account facts, the **sales summary** (7/30/90 days: net sales, transactions, active days, refunds, payment types, sales modes, busy hours), payment history and extra trial days. The console never opens a merchant's menu, receipts, customers or staff.
  - **Catat pembayaran** after the money arrives: pick the plan (fills price and days), method, reference, payment date. The account is extended from its current end date, so remaining trial or paid days are kept.
  - **Batalkan** on a payment (with a reason) reverses it; it stays in the history.
  - **Tambah hari coba**: 1–60 free days with a reason.
- **Pembayaran**: one month at a time, total received, cancelled count, **Unduh CSV** for bookkeeping.
- **Laporan**: executive report for 7/30/90/365 days. *Bisnis Pikul*: subscription revenue, sign-ups, paying now, conversion, stopped paying, revenue by month, sign-ups by week. *Semua merchant*: net sales, transactions, average receipt, merchants selling, refunds, daily trend, payment types, sales modes, weekday averages, merchants by activity, busy hours, top 10. **CSV per merchant** exports totals per merchant.
- **Paket harga** and **Kampanye**: as before (ADR-014). New placement **Saat buka kasir pertama hari itu**: the banner shows once per day when a merchant opens the register (clickable when it has a link). New campaigns start at the next full hour; change the start time to show one now.
- **Konten landing**: headline, subheadline, feature cards, FAQ (add, edit, reorder, hide), footer contact. **Simpan** updates the landing page within about a minute; **Pulihkan bawaan** returns to the built-in text. Plain text only.

## Where the sales numbers come from
Each merchant app sends its daily totals (counts and Rupiah only) when online: on open, every 30 minutes, on reconnect and at day close; the first send covers 35 days. Merchants see a one-time notice and the landing FAQ explains it. Until device sync exists, a store with two devices reports from whichever sent last that day.

## Housekeeping (monthly)
`delete from rate_events where at < now() - interval '1 day'; delete from admin_sessions where expires_at < now();`

## Troubleshooting
| Symptom | Check |
|---|---|
| "Konsol belum aktif…" | `ADMIN_PASSWORD` missing or shorter than 12 characters; redeploy after setting it |
| "Terlalu banyak percobaan salah…" | Wait 15 minutes; check Functions logs for 429s on `/api/admin/login` |
| Yellow "Mode pratinjau" banner | No admin API answered: the site is served without Pages Functions. Data shown is an example |
| Merchant summary empty | The merchant has not been online since selling; numbers arrive on the next open/reconnect |
| "Data merchant baru saja berubah" | Someone else changed the account at the same moment; reload and record again |
| Register banner not showing | Campaign live (not *Terjadwal*), placement on, merchant opened the register for the first time today on that device (`kk.registerPopupShown`) |

## Local test
```
node scripts/gen-pass-key.mjs > /tmp/keys.env && set -a && . /tmp/keys.env && set +a && npx vite build
printf 'PASS_PRIVATE_JWK=%s\nAPP_ORIGIN=http://localhost:8788\nADMIN_PASSWORD=uji-konsol-pikul-2026\nDEV_MODE=1\n' "$PASS_PRIVATE_JWK" > .dev.vars
npx wrangler pages dev dist --port 8788 > /tmp/wrangler.log &
python3 e2e/v17.py http://localhost:8788 /tmp/out /tmp/wrangler.log uji-konsol-pikul-2026
```
Restart wrangler between runs (memory DB; the wrong-password step counts toward the lockout).

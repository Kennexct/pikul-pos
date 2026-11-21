# Admin console: plans and promo campaigns (v0.15, ADR-014)

Open `https://<your-domain>/admin/`, type your email, then the 6-digit code from the email. Only emails in `ADMIN_EMAILS` get in, and the session must be younger than 12 hours (sign in again after that). Closing the tab signs you out.

## Plans ("Paket harga")
- Each card is one plan: name, price (Rupiah), duration in days, small label (e.g. "Hemat 2 bulan"), note, feature lines (one per line, max 8), order, and **Dijual** (shown on the landing page and in the app).
- **Simpan** publishes immediately: the app shows it at once, the landing page within about a minute.
- **Tambah paket** creates a new plan. Its code (e.g. `quarterly`) cannot change later.
- Plans are never deleted; switch **Dijual** off to hide one.
- Every plan unlocks every feature. Feature lines are marketing text only.
- No online payment is connected (ADR-015), so plans are shown for information.

## Campaigns ("Kampanye promo")
- **Kampanye baru** → internal name, banner image (PNG/JPG/WebP, max 500 KB, about 1200×800 px works well), title (also the image's alt text), optional text.
- **Tautan di balik banner**: optional. With a link, clicking the banner or the button opens it. Use `https://…` (e.g. a WhatsApp link) or a page on the site such as `/app/`. External links open in a new tab.
- **Jadwal**: start and end, in your browser's time zone. **Nyala** off hides it even inside the schedule.
- **Tempat tampil**: landing page (once per browser), merchant app (once per account, after sign-in or the next time the app opens online), or both.
- **Harga promo**: optional. Pick a plan and a lower price; while the campaign is live, the landing page and the app show the normal price struck through and the promo price with its end date.
- The list shows the state: *Tayang sekarang*, *Terjadwal*, *Selesai*, *Mati*. The switch in each row turns it on or off at once. The bin deletes it (it disappears everywhere; the audit log keeps the record).
- When two campaigns are live in the same place, the one that started last is shown. When two promos target the same plan, the lower price wins.

## Audit
Every save, switch, delete and upload is written to the `admin_audit` table in Neon (who, what, when, new values):
`select at, email, action, target from admin_audit order by at desc limit 50;`

## Troubleshooting
| Symptom | Check |
|---|---|
| "Akun ini bukan admin Pikul." | Add the email to `ADMIN_EMAILS` and redeploy |
| "Demi keamanan, masuk lagi setiap 12 jam." | Expected; sign in again |
| Pop-up does not appear on the landing page | State must be *Tayang sekarang* and "Halaman depan" on; each browser sees it once (clear `kk.landingPopupsSeen` in localStorage to test again) |
| Pop-up does not appear in the app | "Aplikasi merchant" on, the device online, and the account has not seen it yet (`kk.campaignsSeen`) |

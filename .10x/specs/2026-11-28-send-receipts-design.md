# Send receipts by WhatsApp and email (v0.21.0) — design

**Date:** 2026-11-28 · **Feature slug:** `send-receipts` · **ADR:** ADR-028
**Asked by Kenny:** "send invoice or receipt from email and whatsapp (send using image format), attach with link to preview the receipt from web (if user choose to click the link), when cashier click whatsapp to send invoice, make sure send the invoice directly to customer phone number from POS" → brainstorm in the thread → chose "Direct chat + link, image share extra".

## Problem
The receipt sheet's WhatsApp button opens `wa.me/<number>?text=` with a long plain-text receipt. There is no image, no web copy the customer can open later, and no email. A web app cannot put an image into a specific WhatsApp chat: `wa.me` targets a number but carries text only; the Web Share API carries a file but cannot target a number; only the WhatsApp Business Cloud API does both (Meta verification, sender number, templates, per-message cost).

## Decisions
1. **WhatsApp, main button (direct chat).** Opens `wa.me/<customer number>` (as today; no number → WhatsApp asks whom). Message: shop name, receipt number, total, payment method, a short thank-you, and the receipt link `https://<domain>/r/<token>`. The link page carries `og:image` = the receipt PNG, so WhatsApp shows the receipt as a picture preview in the chat. Without an account or before the first sync the message falls back to today's full text receipt, so nothing is lost offline.
2. **"Bagikan gambar" (image share).** Where `navigator.canShare({files})` works it shares the receipt PNG (+ link in the text) through the phone's share sheet; the cashier picks the app and chat. Elsewhere (desktop, tablet browsers without file share) the same button reads "Simpan gambar" and downloads the PNG. On a phone-width half button it reads "Gambar".
3. **Email.** "Email" button (signed-in store and the server has Resend: `GET /api/auth/options` → `receiptEmail`, remembered for offline) → small sheet with the address (prefilled from the customer's new optional `email`, editable; "Simpan ke data <nama>" switch appears when the typed address is new). Sent by the server through Resend: from `"<Nama toko> via Pikul" <struk@<domain>>`, reply-to the shop owner's account email, subject "Struk <receiptNo> · <Nama toko>", HTML receipt in the body, the PNG attached, and the link. Offline: queued, sent on the next sync; the sheet says "Akan dikirim saat online".
4. **Receipt image** is drawn on the device (Canvas, from the same data as `ReceiptView`, 58 mm look, 2× scale, PNG, typically < 80 KB). No server rendering, works offline.
5. **Web receipt page** `/r/<token>`: read-only receipt (same layout), "Unduh gambar" button, shop name/address/phone, footer "Dibuat dengan Pikul". `noindex`, no customer phone or email ever shown; customer name shown. Voided/refunded → banner "Dibatalkan" / "Dikembalikan Rp…". Expired or unknown token → "Struk tidak ditemukan atau sudah kedaluwarsa".
6. **Link lifetime 90 days** from creation (a later void/refund update keeps it); expired rows are deleted on the next share by any store.
7. **Only signed-in stores** get links and email (both need the server). Offline-only stores keep today's text WhatsApp, print and image share.
8. **Buttons on the receipt sheet:** WhatsApp (primary of the share row), Email, Cetak, Bagikan gambar (if supported); "Transaksi baru" stays primary below. Same buttons on a receipt opened from Riwayat.

## Data and server
- Token: 22-char base64url from 16 random bytes, made on the device when the cashier first shares that receipt (`receiptShares` Dexie table: orderId, token, createdAt, uploadedAt?). Same token reused for later shares of that receipt.
- Upload runs after each sync and right after a share (`services/receiptShare.ts` `flushReceipts`, never the sell path): `POST /api/receipts/share {token, orderId, doc, png}` (auth: account). The device keeps the JSON it last uploaded; a different copy (void, refund) is uploaded again. Dexie v6 tables `receiptShares` (orderId, token, cashierName, uploadedDoc) and `receiptEmails` (queue, 5 tries).
- The copy is `ReceiptDoc` (`lib/receiptDoc.ts` ↔ `server/receiptTypes.ts`): shop, rows of formatted text (meta/item/sub/line/total/rule/alert/note), footer, total, banner, lang. The server checks shape, lengths and control characters and escapes everything it renders.
- Neon `receipt_shares(token pk, account_id, order_id, doc jsonb, image_b64, created_at, updated_at, expires_at)`; migration `007_receipt_shares.sql`. Image ≤ 300 KB, sniffed PNG only (the device steps down from 2× to 1× for very long receipts).
- `GET /r/<token>` (HTML, server-rendered, no app bundle, `noindex` meta + `X-Robots-Tag`, `Referrer-Policy: no-referrer`) and `GET /r/<token>.png` (cached 5 min; the page adds `?v=<updated>`). Routed to the function by `scripts/vercel-build.mjs`.
- `POST /api/receipts/email {token, to}`: account auth, ≤ 100 emails per store per day, one address per call, address validated. `Mailer.sendReceipt` added next to `sendLoginCode`.

## Out of scope
WhatsApp Business Cloud API (later paid add-on), PDF invoices, sending from the merchant's own email domain, thermal-printer image printing.

## Testing
Unit: receipt canvas layout (snapshot of draw calls), WhatsApp message builder (with/without link), token, server share/email/page (auth, size, expiry, status banner, rate limit, never leaks phone/email). e2e `v25.py` phone + tablet: sell → WhatsApp href has number + link; email sheet queues offline and sends online (mock mailer); `/r/<token>` renders; void shows "Dibatalkan". Re-run `flow`, `v16`, `v19`.

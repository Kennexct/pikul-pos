# Review — send receipts (v0.21.0, ADR-028)

**Date:** 2026-11-28 · **Verdict:** PASS (QA + security)

## Security
- **Public page holds customer data.** Only what the printed receipt shows (shop, items, customer name). The device never puts the customer's phone or email in the copy; the server copies only known fields (`checkReceiptDoc`) and a test proves extra fields are dropped. Link = 128 random bits (22 base64url chars), `noindex` meta + `X-Robots-Tag`, `Referrer-Policy: no-referrer`, 90-day expiry, 404 page after.
- **Stored XSS.** Every string is escaped in `receiptHtml.ts`; control characters and unknown line kinds are refused; images must sniff as PNG (SVG refused). CSP from `vercel-build.mjs` applies (no scripts needed on the page).
- **Token takeover.** A token belongs to one account and one order (`putReceiptShare` updates only when both match; 409 otherwise).
- **Mail abuse.** Signed-in only, one plain address per call (no lists, no display names), 100 per account per rolling day (`rate_events`), only for a receipt that account uploaded. From name stripped of quotes/brackets/line breaks; From address fixed by `MAIL_FROM`.
- **Sell path.** Nothing new runs before or during payment; tokens are local; uploads run after sync or after the cashier taps share. Offline WhatsApp still sends the full text.
- **Size.** Share body ≤ ~465 KB (PNG ≤ 300 KB + doc ≤ 64 KB); device steps the PNG down to stay under.

## QA
- Unit: server share/page/image/email/expiry/cap (10), device doc/layout/message (9), share service against the real router (3), customer email (1).
- e2e `v25.py` phone + tablet; regressions v19, customers, flow pass. `history.py` fails at its void step on `main` too (pre-existing).

## Follow-ups (not blocking)
- WhatsApp may show no preview if the cashier sends before the upload lands (the link works once uploaded).
- Help page could mention the Email button and the link.

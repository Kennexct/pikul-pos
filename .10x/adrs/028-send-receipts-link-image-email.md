# ADR-028: Receipts go out as a WhatsApp chat with a web link, an image share, and email

**Status:** Accepted — Kenny chose "Direct chat + link, image share extra", then "Do it" (2026-11-28)
**Date:** 2026-11-28
**Feature:** send-receipts
**Author:** 10x-Team (Architect + PM)

## Context
Kenny wants receipts sent as images by WhatsApp and email, with a web preview link, and WhatsApp must go straight to the customer's number. A web app can target a WhatsApp number (`wa.me`) or attach an image (Web Share), never both; only the WhatsApp Business Cloud API does both. The POS must keep selling offline (non-negotiable).

## Decision
- The WhatsApp button keeps `wa.me/<customer number>` and sends a short message with a link to a web receipt `/r/<token>`; that page's `og:image` is the receipt PNG, so the chat shows the receipt as a picture.
- A second "Bagikan gambar" button shares the PNG through the share sheet where supported.
- Email is sent by the server through Resend with the PNG attached and the link.
- The PNG is drawn on the device. Link snapshots and email requests travel through the sync outbox after the sale, never on the sell path. Links are unguessable, unindexed, expire after 90 days, never show the customer's phone or email, and exist only for signed-in stores.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Image share sheet only | Real image every time | Cashier must find the chat; no number targeting | Breaks "directly to the customer's number" |
| WhatsApp Business Cloud API | Automatic image to the number | Meta verification, sender number, templates, ~Rp300–400/receipt, sender is "Pikul" | Cost and setup; later paid add-on |
| Server-rendered image (satori/@vercel/og) | Same image everywhere | New deps, needs online, more function time | Device can draw it offline |
| `mailto:` from the cashier's phone | No server | No attachment, sends from the cashier's own address | Not a real receipt email |

## Consequences
Positive: one tap to the right chat with a visible receipt picture; works offline (falls back to the text receipt); email reuses Resend. Negative: customer data (items, name) now sits on the server for 90 days; a new public route needs rate limits; Resend volume may need the paid tier. Risk: if the cashier sends before the upload finishes, WhatsApp shows no preview, but the link works once synced.

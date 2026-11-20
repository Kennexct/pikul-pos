# Admin console: plans and promo campaigns (v0.15) — 2026-11-20

## Ask (Kenny, 2026-11-20)
"I need 1 admin console for me to access, to set the POS plan, also adjust pop-up marketing promos from the admin console and push them to the landing page as campaigns."

## Decisions
- One owner-only console at `/admin/`, a separate page from the POS PWA (not cached by the service worker, never offline).
- Access: sign in with the existing email code; the account's email must be listed in the `ADMIN_EMAILS` secret. No admin email lives in the repo.
- Plans move from code (`PLANS` constant) to the `plans` table. Plan settings drive the landing page, the app's Langganan screen and the Midtrans amount.
- Campaigns are scheduled pop-ups (start, end, on/off). A campaign may also carry a promo price for one plan; while it is live, checkout charges that price (decision card sent to Kenny; built with the recommended option).
- The landing page stays static HTML (prices in it are the fallback for no-JS and crawlers). A small script reads `GET /api/public/landing` and redraws the paid plan cards and shows the live pop-up. "Push to landing" therefore means: saving is publishing, within about a minute (edge cache 60 s).

## Plans
Fields: id (slug, fixed after creation), name, price (integer Rupiah ≥ 1.000), duration in days (1–1.095), note, badge, features (up to 8 lines), shown/sellable switch, sort order.
- Plans are never deleted (payments point at them). Turning one off hides it from the landing page and the app and refuses new checkouts.
- Features are display bullets. Every paid plan unlocks the full app; per-plan feature gating is out of scope (it would need the offline pass to carry features).
- Payments keep a snapshot (plan name, amount, days, campaign) so later edits never change an open or past payment.

## Campaigns
Fields: internal name, pop-up title, text, optional image URL, button label + link, start, end, on/off, optional plan + promo price.
- Live = on, not deleted, start ≤ now < end. Several live: the newest start wins the pop-up; for prices the lowest live promo per plan wins.
- Pop-up: shown 2.5 s after load, once per campaign per browser (dismiss remembered in localStorage), closes with ✕, Esc or the backdrop, focus moves into it, reduced motion respected.
- Promo price must be lower than the plan's normal price. Landing and app show the normal price struck through and "Promo sampai <date>".
- Delete = archive (hidden from lists; kept for payment history).

## Security
- Admin endpoints: bearer refresh token → account → email in `ADMIN_EMAILS` → token issued in the last 12 hours. Otherwise 403/401.
- Console keeps its token in `sessionStorage` (closing the tab signs out).
- Every admin write goes to `admin_audit` (who, what, when, the new values).
- Campaign links and images: only `/…` paths or `https://` URLs. The landing script builds DOM nodes with textContent, never innerHTML.
- `/admin/*` is served with `X-Robots-Tag: noindex` and `Cache-Control: no-store`. Optional extra layer: Cloudflare Access on `/admin/*` (runbook).

## Out of scope
Per-plan feature gating, promo codes typed by the buyer, A/B tests, analytics of pop-up views, multiple admins with roles, rebuilding the static HTML on publish.

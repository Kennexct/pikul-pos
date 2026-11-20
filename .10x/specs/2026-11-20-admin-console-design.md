# Admin console: plans and promo campaigns (v0.15) — 2026-11-20

## Ask (Kenny, 2026-11-20)
"I need 1 admin console for me to access, to set the POS plan, also adjust pop-up marketing promos from the admin console and push them to the landing page as campaigns."
Follow-ups: pop-up banner with scheduling and an optional link behind it; optionally pushed to the merchant app, shown the first time a merchant signs in. Then: remove Midtrans completely (ADR-015).

## Decisions
- One owner-only console at `/admin/`, a separate page from the POS PWA (not cached by the service worker, never offline).
- Access: sign in with the existing email code; the account's email must be listed in the `ADMIN_EMAILS` secret. No admin email lives in the repo.
- Plans move from code (`PLANS` constant) to the `plans` table. Plan settings drive the landing page and the app's Langganan screen. (Midtrans was removed the same day, ADR-015: there is no online checkout.)
- Campaigns are scheduled pop-up banners (start, end, on/off), for the landing page and/or the merchant app (once per account after sign-in). Uploaded banner image, optional link behind the banner. A campaign may carry a promo price for one plan, shown while it is live (Kenny chose "pop-up plus real promo price").
- The landing page stays static HTML (prices in it are the fallback for no-JS and crawlers). A small script reads `GET /api/public/landing` and redraws the paid plan cards and shows the live pop-up. "Push to landing" therefore means: saving is publishing, within about a minute (edge cache 60 s).

## Plans
Fields: id (slug, fixed after creation), name, price (integer Rupiah ≥ 1.000), duration in days (1–1.095), note, badge, features (up to 8 lines), shown/sellable switch, sort order.
- Plans are never deleted (stable codes for campaigns, the audit log and a future payment provider). Turning one off hides it from the landing page and the app.
- Features are display bullets. Every paid plan unlocks the full app; per-plan feature gating is out of scope (it would need the offline pass to carry features).

## Campaigns
Fields: internal name, title (also alt text), optional text, uploaded banner (PNG/JPEG/WebP ≤ 500 KB, stored in Neon), optional link + button label, start, end, on/off, landing and/or app, optional plan + promo price.
- Live = on, not deleted, start ≤ now < end. Several live: the newest start wins the pop-up; for prices the lowest live promo per plan wins.
- Pop-up: shown 2.5 s after load, once per campaign per browser (dismiss remembered in localStorage), closes with ✕, Esc or the backdrop, focus moves into it, reduced motion respected.
- Promo price must be lower than the plan's normal price. Landing and app show the normal price struck through and "Promo sampai <date>".
- Delete = archive (hidden everywhere; kept for the audit trail).
- In the app: fetched online ~1.5 s after the POS opens; shown once per account per device; never blocks offline selling.

## Security
- Admin endpoints: bearer refresh token → account → email in `ADMIN_EMAILS` → token issued in the last 12 hours. Otherwise 403/401.
- Console keeps its token in `sessionStorage` (closing the tab signs out).
- Every admin write goes to `admin_audit` (who, what, when, the new values).
- Campaign links and images: only `/…` paths or `https://` URLs. The landing script builds DOM nodes with textContent, never innerHTML.
- `/admin/*` is served with `X-Robots-Tag: noindex` and `Cache-Control: no-store`. Optional extra layer: Cloudflare Access on `/admin/*` (runbook).

## Out of scope
Per-plan feature gating, promo codes typed by the buyer, A/B tests, analytics of pop-up views, multiple admins with roles, rebuilding the static HTML on publish.

# ADR-019: Admin console without email sign-in (temporary)

**Status:** Superseded by ADR-020 · 2026-11-21
**Context:** Kenny: "for admin console, remove the email first, so I can access the page". Email codes (Resend) and the admin API run as Cloudflare Pages Functions; the current deploy is static on Vercel, so `/admin/` stopped at the email screen and no code could arrive.

## Decision
- `/admin/` has no sign-in screen. It opens straight to Paket harga / Kampanye promo.
- Server: `ADMIN_OPEN=1` (Pages Functions variable, default off) skips the `ADMIN_EMAILS` + 12-hour session check. Audit rows name the actor `admin-tanpa-login`. Without the flag the admin API still answers 401, so nothing is opened by accident.
- Client: if `/api/admin/catalog` does not answer with a catalog (static host, 404) the console runs in **preview mode** (`src/admin/previewStore.ts`): same validation as the server (`server/catalog.ts`), data in this browser's localStorage only, image upload off, yellow banner says changes do not reach the landing page or the app. A 401/403 shows preview with "set ADMIN_OPEN=1".

## Risk
With `ADMIN_OPEN=1` anyone who knows `/admin/` can change prices and pop-ups. Use it only until Resend + Cloudflare are live, then remove the flag and revert this commit to bring the email sign-in back.

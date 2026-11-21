# SDE — rebrand-pikul (built 2026-11-20)

- Copy: 24 source files `KasirKu` → `Pikul` (i18n keys + `en.ts`, help ID/EN, admin, onboarding, sign-in, PDF footer, email, HTML titles, manifest `Pikul — Kasir UMKM` / `Pikul`).
- `APP_NAME = 'Pikul'`; JWT issuer `pikul` (server + client + tests); package `pikul`; `.env.example` placeholders `pikul.pages.dev`, `masuk@pikul.id`.
- File names: `pikul-cadangan-…json`, `pikul-<toko>-<range>.<ext>`.
- Frozen with comments: Dexie `kasirku`, `kasirku-cart`, `kasirku-lang`, `kasirku-active-member`, `BACKUP_APP_ID`.
- Logo: `Brand/Logo.tsx` redrawn from brand kit geometry; tokens `--color-kunyit`, `--color-santan` (logo only).
- Icons: favicon.svg, icon-192/512, maskable-512, new apple-touch-icon-180 (full bleed), favicon-32; linked in app + landing.
- Landing: `build.py` logo + tagline in footer + og:site_name; regenerated `index.html` and `landing/index.dc.html` (generator was in sync before the change).
- Docs: README, MASTER.md (Brand + Legacy identifiers), runbooks, new `docs/runbooks/rename-cloudflare-github.md`.
- Tech debt: landing screenshots in `public/landing/*.png` still show the old receipt logo in the app's side rail (small). Re-shoot after deploy.

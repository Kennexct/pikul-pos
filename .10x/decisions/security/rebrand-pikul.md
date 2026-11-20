# Security — rebrand-pikul

- JWT issuer changed `kasirku` → `pikul` on both sides in one deploy; no passes were ever issued (nothing deployed). If a deployment ever ran v0.15 with real users, they would need to sign in once more (pass rejected → app asks to sign in; sales stay on device).
- No secrets added. New icons are static PNG/SVG from the brand kit. The favicon SVG carries C2PA provenance metadata only (no script).
- Backup restore still checks the `app` marker; renaming the file name does not loosen validation.
- Verdict: PASS.

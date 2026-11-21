# Security — rebrand-pikul

- JWT issuer: server now issues `pikul`; the device accepts `pikul` and the legacy `kasirku` (same ES256 key), so passes from any earlier deployment keep verifying. Any other issuer is rejected (unit test).
- No secrets added. New icons are static PNG/SVG from the brand kit. The favicon SVG carries C2PA provenance metadata only (no script).
- Backup restore still checks the `app` marker; renaming the file name does not loosen validation.
- Verdict: PASS.

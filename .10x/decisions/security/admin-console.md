# admin-console (v0.15) — Security
- AuthN/Z: existing email-code sign-in + `ADMIN_EMAILS` allow-list (Cloudflare secret, not in repo) + session issued ≤ 12 h; 401/403 otherwise. Console token in sessionStorage. Optional Cloudflare Access on `/admin/*`.
- Audit: every write in `admin_audit` (email, action, target, new values).
- Stored XSS: campaign text rendered with textContent (landing) / React (app, console); links and image URLs only `/…` (not `//`) or `https://` without credentials; `javascript:`/`data:`/`http:` refused (tests).
- Uploads: PNG/JPEG/WebP by magic bytes only (no SVG), ≤ 500 KB, served with sniffed type + nosniff; request body cap raised only for that route.
- External links open with `rel=noopener noreferrer`.
- Residual: an XSS in `/app` could use Kenny's app refresh token against admin endpoints within 12 h of issue — CSP (open item) is the mitigation. No rate limit on admin endpoints (allow-list makes abuse unattractive).

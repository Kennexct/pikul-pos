# Security — admin console revamp (ADR-020)

Verdict: PASS for launch once `ADMIN_PASSWORD` is set (≥ 12 chars, random).
- Access: one admin password in a Cloudflare secret; compared as sha-256 digests with constant-time equality. Sessions are random tokens, only the hash stored, 12 h expiry, logout deletes it. Lockout: 5 fails per IP or 20 overall in 15 min (429). Trade-off: someone can lock Kenny out for 15 min by guessing; acceptable, logged as a risk.
- No merchant access: the console has no route that reads a merchant's menu, receipts, customers or staff; only account fields, payments/grants and daily totals.
- Daily totals: authenticated by the merchant's own refresh token, written only to that account; strict validation, 64 KB body, 35 rows, 120 posts/hour. Totals only (unit test asserts no product, customer, method or staff names). Disclosed in-app once and in the landing FAQ.
- Landing content: plain text, length-limited, no control characters; rendered with textContent only (e2e checks `<b>` stays text).
- CSV exports prefix cells starting with = + - @ to stop formula injection.
- Campaign links still limited to https:// or same-site paths (ADR-014).
- New: strict CSP on `/admin/*` (no inline script, connect-src self, frame-ancestors none) because the session token sits in sessionStorage.
- Preview mode only runs when no admin API answers; it never sends data and uses fake emails.

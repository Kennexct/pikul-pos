# ADR-023: Email + password sign-up with merchant profile; admin sees the profile

**Status:** Accepted — Kenny chose "Email + password" (2026-11-21)
**Date:** 2026-11-21
**Feature:** vercel-neon-launch
**Author:** 10x-Team (Architect + Security)

## Context
ADR-013 signs merchants in with a 6-digit email code (Resend) and creates the account on first sign-in, collecting only the email. Kenny wants separate sign-up and sign-in pages, and every sign-up detail visible in the admin console. Kenny has no verified Resend domain yet, which would block every sign-in.

## Decision
- `POST /api/auth/signup` {email, password, ownerName, storeName, phone, city} creates the account (14-day trial) and returns a session (pass + refresh token), same as before.
- `POST /api/auth/login` {email, password}. Lockout: 5 failures per email or 20 per IP in 15 min (`rate_events`). Same error for unknown email and wrong password.
- Password hash: PBKDF2-SHA256, 210,000 iterations, 16-byte random salt, stored as `pbkdf2$<iter>$<salt b64>$<hash b64>`; compared in constant time. 8–128 characters.
- Forgot password: `POST /api/auth/code` (only sends for existing accounts; same reply either way) + `POST /api/auth/reset` {email, code, password}. Available only when Resend is configured; `GET /api/auth/options` tells the page. Without email: admin "Buat kata sandi sementara" (12 random characters, shown once, audit-logged); all the merchant's refresh tokens are revoked on any password change.
- `POST /api/auth/password` (bearer refresh token) {current, password} for Settings.
- Email code sign-in (`/api/auth/verify`) no longer creates accounts. Google sign-in signs in existing accounts only.
- Profile columns on `accounts`: `owner_name`, `store_name`, `phone` (digits, normalised to 62…), `city`, `password_hash`, `password_changed_at`. Admin list, sheet, search and CSV show them.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Email code only + profile step | No passwords to store | Blocked until Resend domain verified | Launch blocker |
| Profile collected after first sign-in | Smaller sign-up form | Admin sees blank rows for drop-offs | Kenny wants details at sign-up |
| bcrypt/argon2 library | Stronger KDF | Native/wasm deps in a serverless bundle | PBKDF2 via WebCrypto is built in everywhere |

## Consequences
### Positive
- Launch needs only Neon + Vercel. Admin sees who signed up and how to reach them.
### Negative
- We now store password hashes (breach impact higher than codes). PBKDF2 210k is OWASP's floor for SHA-256.
- Without Resend, password recovery is manual via admin.
### Risks
- Credential stuffing → lockout per email and per IP; Vercel firewall rule recommended in the runbook.

## Dependencies
ADR-013 access pass unchanged. ADR-020 admin password unchanged. ADR-022 hosting.

# DevOps — register-categories
- Client-only change; ships with the next Pages deploy. No env vars, no migrations.
- PWA update: the service worker picks up 0.16.0 on next load; devices mid-day are not gated if they already sold today.
- Rollback: redeploy the previous build; the `meta` openings and audit rows are harmless to older versions.

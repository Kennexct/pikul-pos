# SRE — vercel-neon-launch
- SLO intent: selling 100% offline-capable (no server dependency). Sign-up/sign-in: best effort on Vercel + Neon free tiers.
- Monitoring: Vercel Logs (`api_error`, `missing_config`); smoke `curl /api/auth/options` after each deploy.
- Failure modes: Neon cold start (first request slower); Neon down → sign-in/up fail with server_error, devices keep selling on their pass (3-day grace after expiry).
- Runbook: docs/runbooks/deploy-vercel-neon.md (setup, day-to-day, troubleshooting table, rollback).

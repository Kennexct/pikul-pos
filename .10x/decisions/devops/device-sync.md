# DevOps — device-sync (v0.19)
- Order: run `005_device_sync.sql` on Neon → merge → Vercel deploys. No new env vars.
- Function body cap raised to 4.1 MB (Vercel limit 4.5 MB).
- Runbook: `docs/runbooks/deploy-vercel-neon.md` → "Device sync" section + troubleshooting rows. Rollback: promote previous deployment; tables unused.

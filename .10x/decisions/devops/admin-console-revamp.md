# DevOps — admin console revamp

Deploy order: run `db/migrations/003_admin_revamp.sql` on Neon → set `ADMIN_PASSWORD` (encrypted) and remove `ADMIN_EMAILS`/`ADMIN_OPEN` → deploy v0.17.0. The app tolerates the old server (daily-totals POST just fails quietly) and the old app tolerates the new server, so order between app and DB is not critical, but run the migration first.
Rollback: redeploy the previous build; tables added by 003 can stay. Local: `wrangler pages dev` with `ADMIN_PASSWORD` in `.dev.vars` (see runbook).

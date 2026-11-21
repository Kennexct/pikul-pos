# SRE — admin console revamp

- Health: after deploy, `/api/admin/me` → 401 (not 503); `POST /api/merchant/daily` appears in Functions logs within ~30 min of a merchant opening the app.
- Signals: 429 bursts on `/api/admin/login` (someone guessing), 5xx on `/api/merchant/daily`.
- Housekeeping (monthly, Neon SQL editor): `delete from rate_events where at < now() - interval '1 day';` and `delete from admin_sessions where expires_at < now();`
- Data freshness: totals arrive when the merchant is online (on open, every 30 min, on reconnect, at day close); the report says so.

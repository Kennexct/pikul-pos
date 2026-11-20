# SRE — register-categories
- No server component, no SLO change. Runbook: `docs/runbooks/cash-profit-backup.md` § "Register open/close, categories (v0.16)".
- Signal to watch after rollout (from backups/support): days with a closing but no `register_opened` → sellers dismissing the gate; large `opening_cash_changed` deltas.

# Security — register-categories
- No new network surface; everything is local Dexie. Sell path (`completeOrder`/`saveOpenOrder`) unchanged, so the gate cannot stop sales on error (fails open while loading).
- Opening cash is an honest-seller control, not a security boundary: any seller can open (same as Kas before). Tamper evidence: audit `register_opened`, `opening_cash_changed` (from/to, actor). Payload has amounts only, no PII.
- Category management stays owner-only through `OwnerGate` on Produk; names are plain text rendered by React (no HTML), length-capped 80.
- Verdict: PASS.

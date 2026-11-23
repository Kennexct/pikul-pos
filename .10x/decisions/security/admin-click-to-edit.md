# Security — admin-click-to-edit (2026-11-23)
- No server, API, auth or schema change; all writes still go through `requireAdmin` + `checkContent` / `checkPlan` (client checks are convenience only).
- Preview renders admin text as React text nodes; no `dangerouslySetInnerHTML`; e2e confirms `<b>` in an FAQ stays literal on the landing page.
- No new storage (no localStorage of drafts), no new external requests, CSP unchanged.
- Verdict: PASS.

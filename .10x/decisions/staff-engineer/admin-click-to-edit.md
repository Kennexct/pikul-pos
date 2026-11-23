# Staff Engineer — admin-click-to-edit (2026-11-23)
- Reuse `Tabs`, `Sheet`, `Switch`, `RupiahInput`, `option()` chips, `badge*`, `card`; semantic tokens only; lucide icons.
- Indonesian strings via `t()`, English in `src/i18n/en.ts`; `npm run i18n:check`.
- Files < 400 lines, no `any`, no `console.log`. Preview must not use `dangerouslySetInnerHTML`.
- Logic in `editing.ts` with Vitest unit tests (test env is node; no RTL in repo). UI covered by `e2e/v17.py`.
- Limits come from `LIMITS` (server/siteContent) and server catalog constants (`MIN_AMOUNT`, `MAX_AMOUNT`, `MAX_DAYS`).

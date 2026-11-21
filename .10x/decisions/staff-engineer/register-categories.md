# Staff engineer — register-categories
- Reuse: `Sheet`, `RupiahInput`, `Tabs`, `card`, `option()`, `btn*` classes, `useLiveQuery`, `saveAndQueue`, `writeAudit`.
- `POSPage.tsx` is at 400 lines: extract the phone cart bar to `components/CartBar.tsx` before adding the gate.
- All copy via `t()` with English in `en.ts`; i18n:check must pass. No `any`, no `console.log`.
- Fail open on the cashier: if status is unknown (loading), do not gate.

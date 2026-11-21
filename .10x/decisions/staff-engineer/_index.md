# Staff Engineer — index

[DISCOVERED] ECC conventions: KISS/DRY/YAGNI, immutability, files < 400 lines, early returns, named constants, `import type`, no `any`, no console.log.
[DISCOVERED] Design system: `design-system/MASTER.md` — semantic tokens only, shared components (Sheet, SegmentedControl, Tabs, Switch, Select, EmptyState, PageHeader).
[DISCOVERED] Money = integer Rupiah everywhere; `num` utility for tabular figures.
[DISCOVERED] Errors: services throw `Error` with Indonesian user-facing messages; UI shows via react-hot-toast.

## Features
- reports-export — one-definition rule, DRY extractions, bundle discipline → `reports-export.md`
- staff-pin — single rule function, secrets hygiene → `staff-pin.md`
- register-categories (v0.16) — ADR-017 → `register-categories.md`
- admin-console-revamp (v0.17) → `admin-console-revamp.md`
- `admin-sidebar-nav` — admin console left sidebar (ADR-021)

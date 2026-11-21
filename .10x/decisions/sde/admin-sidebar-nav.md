# admin-sidebar-nav — SDE (built 2026-11-21)
- `src/admin/nav.ts`: sections, groups (Bisnis; Situs & promosi), icons, `sectionLabel`. `nav.test.ts` (3 tests).
- `src/admin/Sidebar.tsx`: brand, grouped menu (`nav aria-label="Menu konsol"`, `aria-current="page"`, counts for plans/campaigns), "Mode pratinjau" note, Keluar (server mode only).
- `src/admin/NavDrawer.tsx`: phone drawer (280 px, scrim, Esc, focus trap, focus back to the menu button). `animate-drawer-in` in `index.css`.
- `AdminApp.tsx`: tab header removed; fixed 240 px `<aside>` from md, sticky phone top bar (menu, section title, Keluar). Section h1 is `sr-only` because each panel already has its own heading.
- i18n: 7 new keys; `Bagian konsol` removed. `Tabs` component unchanged (still used by the app).
- Deviation from spec: no visible page title on tablet (panels already show one).
- Tech debt: none new. `e2e/v15.py` still targets the old email sign-in (pre-existing, superseded by v17).

# Admin console: menu in a left sidebar (v0.17.1) — 2026-11-21

**Feature slug:** `admin-sidebar-nav` · **ADR:** 021 · **Builds on:** ADR-020 (console sections unchanged)

## Ask (Kenny, 2026-11-21)
"Feedback for admin panel, create the menu show at left navbar."
Today the seven sections sit in a tab bar under the header (scrolls sideways on a phone).

## Design
**Tablet and laptop (≥ 768 px):** fixed left sidebar, 240 px, full height, `bg-surface`, `border-r border-line`.
- Top: Pikul mark + "Konsol admin".
- Menu, two groups with small caps headings:
  - **Bisnis:** Ringkasan (LayoutDashboard), Merchant (Store), Pembayaran (Wallet), Laporan (ChartColumn)
  - **Situs & promosi:** Paket harga (Tags, count), Kampanye (Megaphone, count), Konten landing (FileText)
- Item: icon 20 px + label 15 px, 44 px tall; active = `bg-brand-50 text-brand-700` + 3 px brand indicator bar on the left (same language as the cashier app's tablet rail); `aria-current="page"`.
- Bottom: "Pratinjau" chip when in preview mode, then "Keluar" (server mode only).
- Content area to the right scrolls on its own; the sidebar stays put. Section title (h1) at the top of the content.

**Phone (< 768 px):** sticky top bar = menu button (≡, 44 × 44, "Buka menu") + current section title + Keluar icon. The menu button opens the same sidebar as a drawer from the left (280 px, backdrop, Esc / backdrop tap / choosing an item closes it, focus moves into it and back to the button). Reduced motion = no slide.
_(Pending Kenny's choice on the decision card; drawer is the recommended option.)_

## Behaviour kept
- Same seven sections and panels, no panel changes.
- Last section remembered in `sessionStorage` (`pikul.admin.tab`).
- "Open merchant" from Ringkasan/Pembayaran/Laporan still jumps to Merchant.
- Login screen unchanged.

## Components
- `src/admin/nav.ts` — section ids, labels, icons, groups (one source for sidebar and title).
- `src/admin/Sidebar.tsx` — the menu (`<nav aria-label="Menu konsol">`, buttons with `aria-current`).
- `src/admin/NavDrawer.tsx` — phone drawer wrapper (backdrop, focus, Esc).
- `AdminApp.tsx` — layout: sidebar + content; drops the `Tabs` header.

## Testing
- Unit: sidebar renders groups, marks the active item, calls onSelect; drawer closes on Esc and on select.
- e2e `v17.py`: switch helper from `role=tab` to the menu (opens the drawer first on phone). Screenshots phone + tablet.
- Checks: typecheck, i18n:check, tests, build.

## Out of scope
Collapsible/icon-only sidebar on laptop, URL routes per section, new sections.

# Design system memory (AI quick map)

Read this instead of scanning the codebase. Full rules: `MASTER.md`. Drawn version: `design-system/structure.html` (published as https://claude.ai/artifact/TAEZTSogrr8rWokGNPFkSL).
Last mapped 2026-11-26 from `main` @ 6c1b8f2 (v0.20.2). Update the "Usage" and "Drift" tables when you change a shared piece.

## The chain (change flows top to bottom)

```
MASTER.md (rules)
  └─ src/index.css  @theme tokens: --color-* --radius-* --shadow-* --ease-*, @utility num / animate-*
       └─ src/components/ui/styles.ts  class strings (btn*, inputBase, card, option(), badge*, receiptRule ...)
       └─ src/components/ui/*.tsx       Sheet, Tabs, SegmentedControl, Switch, EmptyState, SearchInput ...
       └─ src/components/Layout/*       AppShell, GroupNav (rail / tab bar / SubNavList / SubNavTabs), PageHeader, SidePanel
       └─ src/components/Brand/Logo.tsx the only user of kunyit + santan
            └─ src/pages/<Area>/*  and  src/admin/* (admin adds ui.tsx: PanelHead, Section, StatusChip, LoadError, ShareBars)
```

`landing/index.dc.html` + `src/landing/live.ts` do NOT use the tokens (inline hex). See Drift.

## Where to edit for a given ask

| Ask | Edit | Also touch |
| --- | --- | --- |
| Change a color | `src/index.css` `--color-*` | hex mirrors: `App.tsx` toaster (~L68), `pages/Reports/BarChartCard.tsx` (BRAND/GRID/MUTED), `lib/export/pdf.ts` (RGB arrays), `landing/index.dc.html`, `src/landing/live.ts`; MASTER.md color table |
| Button look | `styles.ts` `btnBase` / `btn*` | used in 12 areas, check POS + Cash |
| Input look | `styles.ts` `inputBase`, `labelBase`, `helperText` | `RupiahInput`, `NumberInput`, `SearchInput`, `Select` have their own markup |
| Card / border / shadow | `styles.ts` `card`; tokens `--shadow-*` | MASTER principle 2: only sheets, toasts, cart bar float |
| Pop-up / modal | `components/ui/Sheet.tsx` + keyframes in `index.css` | 15 areas use Sheet; motion table in MASTER.md |
| Radius | `--radius-sm/md/lg/xl` in `index.css` | no `rounded-full` except avatars, count badges, switches |
| Typography | font in `index.css` `--font-sans`; sizes are inline `text-[Npx]` | weights max 600 (logo excepted) |
| Navigation / menu | `components/Layout/navItems.ts` (groups), `GroupNav.tsx` (rail, tab bar, sub-menus) | MASTER.md Layout section |
| Page header | `components/Layout/PageHeader.tsx` (uses `pageTitle`, `NARROW_COLUMN`) | |
| Settings form layout | `fieldGrid` + `pages/Settings/SettingsSection.tsx` (`@container/card`) | |
| Selectable choice | `option(isSelected)` (alias `chip`) | |
| Money total | add `receiptRule` + `border-t` above it; amounts get `num` | only cart, Pembayaran, Kas, receipt |
| Logo | `components/Brand/Logo.tsx` (`Logo`, `LogoMark`, `Wordmark`) | icons in `public/` come from the brand kit only |

## Tokens (names only; values in index.css)

- Brand: `brand-50 100 200 300 500 600 700 800 900`. Primary = 600, active text = 700.
- Neutrals: `canvas` (app bg), `surface` (cards), `subtle` (wells), `line`, `line-strong`, `line-input`, `ink`, `ink-soft`, `muted` (smallest text color), `faint` (icons only).
- Status: `danger-50 200 600 700`, `warn-50 200 700`. Logo only: `kunyit`, `santan`.
- Radius `sm 6`, `md 8`, `lg 10`, `xl 14`. Shadows `xs`, `pop`, `bar`. Eases `out-quart`, `in-quart`.
- Utilities: `num` (tabular money), `animate-sheet`, `animate-fade`, `animate-sheet-in/out`, `animate-dialog-*`, `scroll-x`.

## Usage (which areas import each shared piece)

| Piece | Areas | Notes |
| --- | --- | --- |
| `Sheet` | 15 | most connected UI component in the graph |
| `btnPrimary`, `btnSecondary`, `card` | 12 each | |
| `labelBase` 10, `inputBase` 9, `btnGhost` 8, `option` 8, `helperText` 7 | | |
| `btnDanger`, `btnDangerSolid`, `sectionTitle` | 6 each | |
| `btnIcon` 5; `badgeNeutral/Warn/Brand` 4 each; `receiptRule` 2 (Cash, POS) | | |
| `fieldGrid` 1 (Settings) | | |
| `EmptyState` 10, `LoadingScreen` 9, `PageHeader` 9 | | |
| `SegmentedControl` 7, `Tabs` 6, `Switch` 6, `SearchInput` 6, `RupiahInput` 5 | | |
| `StatTile` 3, `DateRangeControl` 3, `NumberInput` 2, `ProductThumb` 2, `StatusBadge` 2, `SidePanel` 2, `Select` 1 | | |

Areas = `admin`, `components/<X>`, `pages/<X>`. Recount: `grep -rl "<Name\b" src`.

## Drift (known gaps against MASTER.md)

- Landing (`landing/index.dc.html`, `src/landing/live.ts`) uses an older palette: `#0f1a16` (vs ink `#14201b`), `#3d4a44`, `#5b6862`, `#f6f8f7`, `#e3e8e5`, `#c9d2cd`, `#075c44`, weights 700/800, and a `border-radius: 999px` eyebrow tag.
- Hex mirrors that must follow a token change: `App.tsx` toaster, `BarChartCard.tsx`, `lib/export/pdf.ts` (charts, toasts and jsPDF cannot read CSS variables).
- MASTER.md Layout lists Transaksi as "Pesanan, Riwayat, Kas"; the code order (v0.19.6) is Riwayat · Kas · Pesanan.

## Hard rules (short form)

Semantic tokens only in JSX (no `slate-*`, `orange-*`, hex). Touch targets 44px, primary 48px. Weights ≤ 600. No uppercase tracked labels, no pills, no gradients, no emoji, no looping motion, one accent. lucide-react icons, stroke 1.75. Interface text via `t('Indonesian', ...)` + `src/i18n/en.ts`. Files under 400 lines.

## Refresh the graph

```
pip install graphifyy && graphify update src   # re-extract code into graphify-out/ (no LLM)
graphify query "what uses Sheet"               # answers from graphify-out/graph.json
```
`graphify-out/` is git-ignored; the last full graph (1,950 nodes, 73 communities) is in the project files under `design-system-graph/`.

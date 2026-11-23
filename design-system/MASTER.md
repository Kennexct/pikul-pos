# Pikul Design System — MASTER

Source of truth for every screen. Tokens live in `src/index.css` (`@theme`); shared classes in `src/components/ui/styles.ts`.
Components must use semantic tokens only — no raw `slate-*`, `orange-*` or hex in JSX.

## Principles

1. **Speed over decoration.** A seller with one free hand and a queue. Big targets (44px min, 48px primary), fewest taps, money always readable.
2. **Borders carry structure, shadows mean "floating".** Cards = 1px `line` border + `shadow-xs`. Only sheets, toasts and the phone cart bar use `shadow-pop`.
3. **One accent.** Pandan green is the only brand color. Status colors (danger, warn) appear only when there is a status to communicate.
4. **The photo is the only color on a product tile.** No random pastel placeholders — monogram on neutral.
5. **Numbers are first-class.** Every amount uses the `num` utility (tabular figures) so columns of Rupiah align.

## Typography

| Role | Spec |
| --- | --- |
| Family | Plus Jakarta Sans Variable (Tokotype, Jakarta), self-hosted via `@fontsource-variable` — works offline |
| Page title | 22px / 700 / -0.02em |
| Sheet title | 17px / 700 / -0.01em |
| Body / inputs | 15px / 400–500 |
| Secondary | 13–14px, `muted` |
| Section label | 13px / 600 / uppercase / 0.06em, `muted` |
| Big money | 20–36px / 700–800 / -0.02 to -0.03em, `num` |
| Receipt | system monospace 12.5px (thermal-printer feel) |

## Color tokens

| Token | Hex | Use | Contrast on white |
| --- | --- | --- | --- |
| `brand-600` | #0B7A5A | Primary buttons, active states | 5.3:1 (white text on it) |
| `brand-700` | #08654A | Active nav/tab text, links | 7.1:1 |
| `brand-50` | #EBF7F2 | Selected backgrounds, success panel | — |
| `kunyit` | #F2A93B | **Logo only** — the head dot in the Pikul mark | — |
| `santan` | #F6F1E7 | **Logo only** — the mark on the pandan tile | — |
| `ink` | #14201B | Primary text | 16.8:1 |
| `ink-soft` | #36423D | Secondary emphasis | 10.5:1 |
| `muted` | #5E6A65 | Helper text, labels — smallest allowed text color | 5.6:1 |
| `faint` | #8A9590 | Icons/placeholders only, never body text | 3.1:1 |
| `line` / `line-strong` | #E2E7E4 / #C9D1CD | Dividers, card borders / secondary button borders | — |
| `line-input` | #8A9590 | Form control borders (WCAG 1.4.11 ≥ 3:1) | 3.1:1 |
| `canvas` / `surface` / `subtle` | #F7F9F8 / #FFF / #F2F5F3 | App bg / cards / wells, table headers | — |
| `danger-600/700/50` | #C2281D / #A31F16 / #FEF3F2 | Destructive actions, errors, "Kurang" | 5.8:1 / 7.0:1 |
| `warn-700/50` | #9A5B05 / #FFF8EB | Stale open orders, fallback price | 5.1:1 |

## Shape & spacing

- Radius: 6 (`sm`, badges), 8 (`md`, segments), 10 (`lg`, buttons/inputs/cards), 14 (`xl`, sheets). No pill buttons — `rounded-full` only for avatars, count badges, switches.
- Spacing: 4px grid. Page padding 16px phone / 32px tablet. Card padding 16–20px.

## Components (use these, don't re-invent)

| Need | Component |
| --- | --- |
| Mutually exclusive mode (sales mode, discount type, paper size, reference mode) | `SegmentedControl` |
| Sections / categories | `Tabs` (underline, scrolls horizontally) |
| Pick one or many from a set (variants, quick cash, presets) | `option()` class — bordered square, check icon when selected |
| Small number (%, days, counts) | `NumberInput`; a 0 shows as the grey placeholder |
| On/off setting | `Switch` (row with label + description) |
| Sub-menu column (tablet) | `SidePanel` + `sideItem`; folds to an icon strip, choice kept per device |
| Turning something off for sale (Habis) | `Switch tone="danger"`; sold-out controls and badges use danger-600/50 |
| Modal / bottom sheet | `Sheet` (grabber on phone, centered on tablet, title + subtitle) |
| Nothing to show | `EmptyState` (icon in bordered square + title + one line) |
| Search | `SearchInput` |
| Page chrome | `PageHeader` (title, description, actions, tabs slot) |
| Settings group | `SettingsSection` |

## Icons

- lucide-react only, one stroke weight (1.75, set globally on `.lucide`).
- Sizes: 20 nav, 18–20 buttons, 15–16 inline with text.
- Decorative icons get `aria-hidden`; icon-only buttons need `aria-label`.
- No emoji anywhere in the UI.

## Motion

Motion confirms what just happened; nothing loops. Tokens and keyframes live in `src/index.css`.

| Moment | Phone | Tablet |
| --- | --- | --- |
| Sheet / pop-up opens | slides up from the bottom edge, 320ms ease-out-quart | rises 10px and scales from 0.97, 220ms |
| Sheet closes (X, scrim, Escape, swipe) | slides back down, 200ms ease-in-quart, then `onClose` | sinks and fades, 160ms |
| Scrim | `ink/45` + 3px blur, fades in 160ms / out 200ms — translucent so the sale stays visible | same |
| Swipe to dismiss | drag the grabber/header down > 96px (or flick) | — |
| Page change (nav links) | content pane fades out 90ms, new page rises 8px in 220ms (View Transitions; rail and tab bar stay still) | same |
| Tap registered | qty badge on the tile and the cart-bar count pop once (260ms) | same |
| Full-screen hand-off (QRIS) | rises 16px in 280ms | same |
| Horizontal scrollers (`scroll-x`) | the edge hiding more content fades (scroll-driven; no fade when nothing overflows) | same |
| Press feedback | 1px translate / 0.985 scale | same |

- `Sheet` owns its exit: always close through its X/scrim/Escape or by setting `isOpen` false; it unmounts after the exit.
- `Sheet` moves focus into the dialog, traps Tab, gives focus back to the opener, and only the top sheet answers Escape.
- `prefers-reduced-motion` disables all animation, including page transitions; sheets then close instantly.

## Layout

- **Main menu** (`navItems.ts`): Kasir · Transaksi (Pesanan, Riwayat, Kas) · Kelola (Produk, Pelanggan) · Laporan · Pengaturan. A group with several pages shows its sub-menu as a list column (`SubNavList`, 208px) left of the page on tablet and as underline tabs (`SubNavTabs`) on a phone; tapping a group reopens its last visited page. Nav icons are 20px.
- List pages switch to their table layout by the space they get, not the screen: the page pane is `@container/page` and tables use `@4xl/page:` (not `lg:`).
- **Phone (< 768px):** bottom tab bar (Kasir, Transaksi, Kelola, Laporan + Akun: seller, sync, lock, Pengaturan, Bantuan), floating dark "Lihat pesanan" bar above it, 3-column product grid.
- **Tablet (≥ 768px):** 84px side rail (logomark, groups with 3px active indicator, Bantuan "?" at the foot, sync status, cashier avatar); POS = product grid + 340–420px cart column.

## Anti-patterns (reject in review)

Pastel random tile colors · dot-grid or pattern fills behind monograms · endless pulse/float loops · gradient buttons · pill-shaped everything · emoji icons · gray text below `muted` · raw palette classes in JSX · shadows on every card · centered-everything layouts · more than one accent color.

## Page width

- List and data pages (Kasir, Riwayat, Laporan, Produk, Pelanggan, Kas) use the full width.
- Pengaturan (tablet) lists its sections in a left column like the other sub-menus; header and content sit in one left-aligned `max-w-3xl` column beside it. Its save bar appears only when something changed.
- Form-like pages (Bantuan; Pengaturan on a phone) use one centred column for header, tabs and content: `<PageHeader isNarrow>` + `NARROW_COLUMN` (`max-w-3xl`). Never cap content width while leaving it left-aligned.

## Brand (ADR-016)

- Name **Pikul** (formerly KasirKu). Tagline: *Jualan ringan. Catatan beres.* Brand kit v1 lives in the project folder `brand/pikul-brand-kit/` (SVG, PNG, app icons, logo template).
- Logo in the app: `components/Brand/Logo.tsx` — `LogoMark` (pandan tile, santan mark, kunyit head dot) and `Logo` (mark + "Pikul" in ExtraBold, tracking −0.03em). Never redraw it inline; never use `kunyit`/`santan` outside the logo.
- Icons: `public/favicon.svg`, `public/icons/icon-192|512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png` (full-bleed), `favicon-32.png`. Replace them only from the brand kit.

### Legacy identifiers — do not rename
These are invisible to sellers and live on devices or inside files. Renaming any of them without a migration loses data or breaks old backups.

| Identifier | Where | Why it stays |
| --- | --- | --- |
| IndexedDB `kasirku` | `db/localDb.ts` | Every sale on the device lives here |
| `kasirku-cart`, `kasirku-lang`, `kasirku-active-member` | localStorage | Open cart, language, signed-in cashier |
| `app: "kasirku"` (`BACKUP_APP_ID`) | backup files | Old backups must keep restoring |

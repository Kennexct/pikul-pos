# UI/UX review and polish — 2026-11-20

Branch `feat/ui-polish` on top of `feat/rebrand-pikul`. Audit against the antislop UI checklist and `design-system/MASTER.md`,
screenshots on phone (390×844) and tablet (1024×768) before and after.

## What the audit found

| # | Where | Finding | Done |
| --- | --- | --- | --- |
| 1 | All pop-ups (`Sheet`, 40 uses) | Only a 16px fade-rise on open, nothing on close (panel vanished instantly). No focus move/return, no Tab trap, Escape closed every stacked sheet at once | Fixed |
| 2 | Phone sheets | No swipe-to-dismiss although the grabber suggests one | Fixed |
| 3 | Page changes | Screens swapped with no transition | Fixed (View Transitions) |
| 4 | Product tiles | Dot-grid texture behind the monogram + a boxed chip inside the box (stock texture, R-07); in the 40px list thumb it read as a box in a box | Fixed: plain well, initials scale with the tile |
| 5 | POS taps | No confirmation that a tap landed beyond the number changing | Fixed: badge pops once |
| 6 | Horizontal rows (date range, history filters, settings tabs, sales mode) | Items cut at the screen edge with no cue that the row scrolls | Fixed: scroll-driven edge fade |
| 7 | Landing, phone | Header wrapped to three rows (145px of sticky chrome) | Fixed: one row; section links from 720px |
| 8 | Landing hero | Eyebrow pill above H1 repeating the headline | Removed |
| 9 | Landing | Uppercase wide-tracked labels on every section; four identical boxed USP cards (3+1 orphan on tablet); twelve identical boxed feature cards; lightning-bolt icon | Labels sentence case; USP = ruled strip 4/2/1 columns; features = hairline list; stopwatch icon |
| 10 | Landing images | No width/height (layout shift); hero lazy-able | Sized; hero `fetchpriority="high"` |
| 11 | Landing pop-up | Card appeared without motion, no exit, page scrolled behind it | Rises in, sinks out, page scroll locked, translucent blurred scrim |
| 12 | Landing screenshots | `pos.png`, `varian.png` showed the old tiles | Re-shot (pos now shows a real cart) |
| 13 | In-app campaign image | 1px border boxed transparent PNG banners | Border removed |

## Kept on purpose
- Bottom tab bar blur and the sheet scrim blur are the only two blurred surfaces (glass dose cap).
- `LoadingScreen` pulse: it marks a real "loading" state and ends when loading ends.
- Landing "Cara mulai" keeps three steps: that is the real sign-up flow.
- Pricing "Mulai di sini" badge marks the free trial, which is where every seller starts.

## Still open (not done here)
- `bon.png`, `timbang.png`, `tutup-kasir.png` landing shots still show the old dot tiles in the background.
- The landing H1 shows wide gaps before "," and "." at 64px (Plus Jakarta Sans punctuation spacing); consider `font-kerning` / a tighter display cut.
- Python e2e scripts were not run in this session (no Python Playwright); the same sale flow ran in Node Playwright on phone + tablet against `vite preview`: no page errors.

## Checks
typecheck PASS · i18n:check PASS (0 missing) · 165/165 tests PASS · build PASS · no file over 400 lines (except `i18n/en.ts`, a dictionary).

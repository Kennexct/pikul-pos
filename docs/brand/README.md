# Pikul brand (ADR-016)

**Name.** **Pikul** everywhere in the product (ADR-016). "Pikul POS" is fine as the long form where a store listing or search result needs the category. A *pikulan* is the street seller's carrying pole; the promise is "Pikul carries the books so you can sell light".

**Tagline.** *Jualan ringan. Catatan beres.*

**Logo.** A head, a bending pole and two equal loads: a seller carrying a pikulan, which also reads as a balance scale. Masters in `svg/`:

| File | Use |
| --- | --- |
| `pikul-lockup-horizontal-*.svg` | Primary. Landing header, sign-in, receipts |
| `pikul-lockup-stacked-*.svg` | Square spaces, posters, stickers |
| `pikul-mark-*.svg` | Small spaces, avatars |
| `pikul-wordmark-*.svg` | Wordmark alone (outlined Plus Jakarta Sans ExtraBold, never retype) |
| `pikul-app-icon*.svg`, `favicon.svg` | PWA icons (`public/icons/`), favicon (`public/favicon.svg`) |

Variants: `color` (light backgrounds), `reverse` (dark backgrounds), `mono-ink` (thermal receipts, one-colour print), `mono-white`.

**Rules.** Clear space = head diameter on every side. Minimum: mark 20px, horizontal 96px, stacked 44px; print mark 6 mm, horizontal 25 mm. Don't stretch, tilt, recolour, add effects, or put pandan on kunyit. Construction, clear space and sizes: `pikul-logo-template.pdf`.

**Colour.** The app UI is unchanged: pandan (`brand-600` #0B7A5A) is still the only UI accent. Logo-only tokens: `kunyit` #F2A93B (the head) and `santan` #F6F1E7 (mark on pandan). Marketing may also use Daun #0A3D2E as a deep base.

**Type.** Plus Jakarta Sans everywhere (already self-hosted in the app).

The full illustrated guideline (voice, misuse examples, image direction) and the brand board live with the brand kit in the project folder (`brand/`).

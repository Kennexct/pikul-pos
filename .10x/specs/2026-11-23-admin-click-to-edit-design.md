# Admin console: click-to-edit for Konten landing and Paket harga — design

**Date:** 2026-11-23 · **Feature slug:** `admin-click-to-edit` · **Status:** proposed, waiting on Kenny's approval
**Ask (Kenny):** "for landing page and price plan, make sure the form is not open, looks not good because user can misstype at every field. For landing page, create sub section to show the specific field when during click, then also give example preview at the right side."

## Problem
Both tabs render every field of every item as an open text box. One stray tap or keystroke changes live landing text or a plan. The plan form also asks for raw values that are easy to get wrong: a free number for days and for sort order, a plan code typed by hand, features as one multi-line textarea.

## Scope
Admin UI only (`src/admin/*`). Same data, same API (`GET/PUT /api/admin/content`, `POST /api/admin/plans`), same server validation. No migration.

## Konten landing
- **Sub-sections:** `Tabs` with Bagian atas · Keunggulan (n) · Tanya jawab (n) · Kontak. Only the selected one renders.
- **Read-only by default:** each item is a row of plain text (title + first line of text, "Disembunyikan" badge when hidden). Row actions: naik, turun, sembunyikan/tampilkan, hapus (inline "Yakin hapus?" confirm).
- **Click to edit:** clicking a row (or "Ubah") opens only that row's fields in place, with Simpan / Batal. One open row at a time; opening another while the current one has changes asks to discard first. Esc = Batal.
- **Add:** "Tambah …" appends a blank row already open; Batal on a never-saved row removes it.
- **Preview:** a `LandingPreview` component styled like the real landing section (hero block, feature card grid, FAQ list with the edited item expanded, footer contact). It renders the draft as typed, highlights the item being edited, and leaves hidden items out (as the real page does). Rendered with React text nodes only (no HTML).
- **Layout:** two columns (editor | sticky preview) at ≥1280 px viewport (sidebar takes 240 px); below that the preview sits under the editor with a "Contoh tampilan" heading.
- **Save model (recommended):** Simpan on a row writes the whole content document to the server right away (PUT is whole-document already). Hide, reorder and delete also save immediately. The sticky bottom bar is removed. "Pulihkan bawaan" stays at the bottom of the tab.
  - *Alternative if Kenny picks it:* rows only change a local draft; the existing sticky Simpan bar publishes.

## Paket harga
- **Read-only cards** shaped like the landing price card: name, label badge, price, "/ N hari", note, features with check marks, status chip (Dijual / Disembunyikan). Card actions: Ubah, naik, turun.
- **Editor in a `Sheet`** (`isWide`), used for both Ubah and Tambah paket; the card preview sits beside the form on tablet, under it on phone.
- **Fields that can no longer be mistyped:**
  - Masa aktif: options 30 / 90 / 180 / 365 hari + "Lainnya" (numeric input 1–1095 only when chosen).
  - Fitur: list of single-line inputs (max 8, max 80 chars each per server), + Tambah fitur, delete per line; empty lines dropped on save.
  - Kode paket: auto from the name (lowercase, a–z 0–9 and `-`), shown as a hint, editable via "Ubah kode"; locked after creation (unchanged rule).
  - Urutan: no field; the up/down arrows swap `sort` with the neighbour (two saves).
  - Harga: existing `RupiahInput`.
- **Validation before Simpan:** name required, price Rp1.000–Rp100.000.000, days 1–1095, code matches the server pattern `^[a-z0-9][a-z0-9-]{1,23}$`. Simpan stays disabled and shows the reason under the field.
- Closing the sheet with unsaved changes asks "Buang perubahan?".

## Error handling
Server errors keep using `errorText()` toasts; auth errors go through `onError`. A failed row save keeps the row open with the draft intact.

## Testing
- Unit (Vitest + RTL): rows start read-only (no textbox until click); one open row at a time; Batal restores; preview shows typed text and omits hidden items; plan days options; features list max 8; slug from name; Simpan disabled on invalid.
- e2e: update `e2e/v17.py` steps for Konten landing and Paket harga; phone 390×844 and tablet 1024×768 screenshots.
- Checks: typecheck, i18n:check, npm test, build.

## Out of scope
Image or icon pickers, rich text, landing hero image, plan deletion, campaign form changes.

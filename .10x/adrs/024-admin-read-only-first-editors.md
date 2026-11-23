# ADR-024: Read-only-first editors for landing content and plans

**Status:** Accepted
**Date:** 2026-11-23
**Feature:** admin-click-to-edit
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
Konten landing (ADR-020) and Paket harga (ADR-014) render every field of every item as an open input. A stray tap or keystroke changes text that goes live on the landing page, and the plan form asks for raw values (days, sort order, plan code, features as one textarea) that are easy to mistype. Kenny asked for forms that are not open by default, sub-sections for landing content with an example preview on the right.

## Decision
1. **Landing content:** sub-sections behind `Tabs` (Bagian atas, Keunggulan, Tanya jawab, Kontak). Items are read-only rows; one row at a time opens in place (Selesai / Batal). Selesai only changes the page draft; one sticky Simpan publishes the whole document (Kenny chose this). A `LandingPreview` renders the draft beside the editor (≥ 1280 px) or under it, styled like the real page, React text nodes only.
2. **Plans:** read-only cards shaped like the landing price card. Ubah / Tambah paket open a `Sheet` with the form and a live card preview. Constrained inputs: days as 30/90/180/365 + Lainnya, features as up to 8 single-line rows, plan code derived from the name, sort order through up/down arrows (swap `sort` with the neighbour, two saves). Simpan disabled with a reason until the plan passes the same rules as `checkPlan`.
3. Pure helpers (`slugify`, `planProblems`, `swapSort`, row edit state) live in `src/admin/editing.ts` and are unit tested. No server, API or schema change.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Keep open forms, add a "Kunci/Edit" toggle per page | Smallest change | Still a wall of inputs once unlocked; no preview | Does not meet the ask |
| Save per row immediately | No forgotten drafts | Many writes, each purges the public cache | Kenny chose one Simpan |
| Iframe the real landing page as preview | Pixel exact | Needs the content saved or postMessage plumbing; CSP frame rules; slow on phone | Too heavy for a text preview |
| Plan editor inline-expanding the card | No pop-up | Grid reflows; two cards open at once is possible | Sheet is the design-system pattern for forms |

## Consequences
### Positive
- Nothing changes until someone deliberately opens a row or the plan pop-up.
- Plan values outside server rules cannot be submitted.
### Negative
- Editing several items takes more clicks.
- Preview is an approximation of the landing styles; it can drift if the landing page is restyled.
### Risks
- Reorder of plans uses two writes; if the second fails, two plans share a sort value briefly. Mitigation: reload after either result; equal sort is harmless (ties ordered by id).
- e2e `v17.py` selectors for these tabs change; updated in the same change.

## Dependencies
ADR-014, ADR-020, ADR-021. Next ADR: 025.

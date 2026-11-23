# Architect — admin-click-to-edit (2026-11-23) — ADR-024
Components (all `src/admin/`):
- `editing.ts` — pure: `slugify(name)`, `planProblems(draft, existingIds, isNew)`, `swapSort(plans, i, by)`, `rowComplete(row, fields)`, `DAY_CHOICES`.
- `LandingPreview.tsx` — renders hero / features / faqs / contact from the draft; prop `focus` highlights the edited item; hidden items left out. Text nodes only.
- `ContentRows.tsx` — replaces `ContentList.tsx`: read-only rows, one open row (local copy), Selesai/Batal, row actions change the parent draft.
- `ContentPanel.tsx` — Tabs for 4 sub-sections, editor + preview grid (`xl:grid-cols-[minmax(0,1fr)_420px]`, preview `sticky`), existing sticky Simpan bar.
- `PlanCard.tsx` — read-only card + Ubah / naik / turun. `PlanSheet.tsx` — form + preview in `Sheet isWide`. `PlansPanel.tsx` — grid, opens sheet, reorder via `swapSort` + 2× `savePlan`.
Data flow unchanged: `loadContent` / `saveContent` (whole document), `savePlan`.
Failure modes: save error keeps draft/sheet open with toast; reorder partial failure → reload.

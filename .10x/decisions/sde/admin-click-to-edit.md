# SDE — admin-click-to-edit (2026-11-23) — ADR-024
Built:
- `src/admin/editing.ts` (+ `editing.test.ts`, 8 tests): slugify, plan draft/days, planProblems (mirrors checkPlan), planPayload, byOrder, moveSort, moveItem, rowComplete.
- `LandingPreview.tsx`: preview of the selected sub-section; lucide icons mapped from the landing icon names; landing copy fixed in Indonesian (`LP`), not via t().
- `ContentRows.tsx` (replaces deleted `ContentList.tsx`): read-only rows, inline delete confirm, `RowEditor` (Selesai/Batal, Esc = Batal, required-field check, newline stripped except FAQ answers — the server refuses newlines in feature text, which the old textarea allowed).
- `ContentPanel.tsx`: Tabs (Bagian atas, Keunggulan, Tanya jawab, Kontak), one open row, switching away from a changed row refused with "Tekan Selesai atau Batal dulu.", Simpan disabled while a row is open; bottom bar now starts after the sidebar (`md:left-[240px]`).
- `PlanCard.tsx` (PlanFace + read-only card, up/down), `PlanSheet.tsx` (constrained form + preview), `PlansPanel.tsx` (sheet keyed per opening, reorder = moveSort + savePlan per changed plan, reload after).
- i18n: 52 new English entries, 5 unused removed.
- e2e `v17.py`: `no_open_fields`, new landing flow (hero edit, FAQ add, Simpan disabled while open, preview text), `edit_plans` (validation message, auto code, 90 hari, preview, create, reorder).
Deviations: no "Buang perubahan?" when closing the plan sheet (Sheet animates out before onClose). Spec layout breakpoint lowered to 1024 px so the preview is on the right on a landscape tablet.
Tech debt: preview styles copy build.py by hand and can drift if the landing is restyled.

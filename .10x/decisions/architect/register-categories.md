# Architect — register-categories (v0.16) · ADR-017
- Register status derived, pure: `lib/register.ts` `registerStatus({hasOpening, hasCountedSale, hasClosing})`.
- Service: `services/dayClosing.ts` `openRegister`, `hasOpening`; `setOpeningCash` gains `actorId` and audits changes.
- Hook: `hooks/useRegister.ts` live status for today + yesterday-unclosed; `pages/POS/useRegisterGate.tsx` returns banner, sheet and `guard(next)`.
- UI: `components/Register/OpenRegisterSheet.tsx` (open + edit opening).
- Categories: `services/catalog.ts` `saveCategory`, `moveCategory`, `deleteCategory`; UI `pages/Products/CategoriesPanel.tsx`, `CategoryForm.tsx`.
- Variant expand: `pages/Products/ProductRow.tsx` (row + toggle + variant lines) to keep `ProductsPage` under 400 lines.
- Failure modes: gate never touches `completeOrder`; a Dexie error in status query → treated as `open` (fail open; never stop selling).

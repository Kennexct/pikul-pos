# Senior engineer — register-categories
- Gate: `guard(next)` runs `next` immediately when status is `open` or unknown; when `not_open` it stores `next` and opens the sheet, then runs it after a successful open; when `closed` it warns once per mount ("Tetap jual" runs `next`).
- First-tap trigger only when the cart is empty, so adding more items never re-prompts.
- `deleteCategory`: transaction over categories, products, outbox; `saveAndQueue` inside.
- `moveCategory`: renumber all live categories 0..n after swap, so legacy duplicate sortOrders heal.
- Variant rows: the row is a button; the toggle must be a sibling (no nested buttons) → row becomes a grid `li` with toggle column + main button.

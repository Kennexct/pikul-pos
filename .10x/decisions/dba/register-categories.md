# DBA — register-categories
- No Dexie version bump, no new tables. "Opened" reuses `meta` key `openingCash:<store>:<date>` (portable in backups).
- Category delete: soft delete + `categoryId = null` on products via the existing `categoryId` index, in one rw transaction with the outbox.
- Category order renumbered 0..n on each move (heals legacy duplicate sortOrders); ties sort by createdAt.
- Server schema unchanged (sync for these tables is still the legacy push).

# Staff engineer — device-sync (v0.19)
- Keep the framework-free `route()` pattern; new handlers take `(deps, auth, body|ctx)`, auth via `accountFromBearer` like `postDaily`.
- `Repo extends AdminRepo, SyncRepo`; memory repo for tests/dev, neon repo for prod — same split as admin.
- Device: nothing in the sell path awaits sync. `saveAndQueue` stays the only write API; pulled rows are written with plain `put` (no outbox).
- `deviceId` on `SyncMeta` (optional) and set by `newMeta`; orders set it again when paid.
- Interface text Indonesian first with `t()` + `en.ts`; files < 400 lines; no `any`, no `console.log`.
- Never rename: IndexedDB `kasirku`, existing localStorage keys.

# Architect — rebrand-pikul (ADR-016)

- Split: visible copy → Pikul; device/file identifiers (Dexie `kasirku`, localStorage `kasirku-*`, backup `app` marker) frozen with comments.
- Downloaded file names → `pikul-…`; restore validates the marker, so old backups still restore.
- JWT issuer `pikul` on server (`server/pass.ts`) and client (`src/lib/accessPass.ts`) in the same deploy; no passes exist yet.
- Manifest `id: /app/` unchanged → installed PWAs update in place.
- Failure mode guarded: no code path renames the IndexedDB database.

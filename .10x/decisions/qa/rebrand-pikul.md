# QA — rebrand-pikul

- typecheck PASS · i18n:check PASS (1165 keys, 0 missing/unused) · vitest 165/165 PASS · build PASS.
- Built manifest: name "Pikul — Kasir UMKM", short_name "Pikul", id `/app/` unchanged (installed PWAs update in place).
- `grep -ri kasirku dist/` → only the frozen identifiers (IndexedDB name, 3 localStorage keys, backup marker).
- e2e on phone + tablet against `vite preview` at `/app`: `flow.py`, `v10.py` (onboarding "Cara kerja Pikul", help), `v09.py` (backup + restore, file marker still `kasirku`), `v11.py` (English, leftover-Indonesian scan) — all ERRORS: none.
- Visual: landing (phone/tablet), app onboarding, admin sign-in show the Pikul mark and wordmark.
- Not run here: `v14.py`/`v15.py` (need `wrangler pages dev` + Neon); they only changed the test admin email. Run them at deploy.

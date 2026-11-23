# QA — admin-click-to-edit (2026-11-23)
- typecheck PASS · i18n:check PASS (0 missing/unused) · vitest 237/237 PASS (19 fail only when VITE_PASS_PUBLIC_JWK from a generated key is exported in the shell; clean shell passes — pre-existing env sensitivity) · build:vercel PASS.
- e2e `v17.py` on Vercel output, tablet 1024×768 + phone 390×844: PASS, no page errors/5xx. Asserts no input/textarea visible on Konten landing and Paket harga before opening; Simpan disabled while a row is open; invalid plan shows "Nama paket wajib diisi."; landing still renders FAQ as text.
- Manual review of screenshots: rows readable at 1024 (actions under text), preview highlights the open row, plan sheet preview updates.
Not covered: keyboard-only walk-through of the sheet (Sheet focus trap is shared and tested elsewhere); real Neon (memory repo used).

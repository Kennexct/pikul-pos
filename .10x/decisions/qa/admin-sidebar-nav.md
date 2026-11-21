# admin-sidebar-nav — QA
- typecheck, i18n:check (0 missing/unused), 213 unit tests, build: pass.
- `e2e/v17.py` against `wrangler pages dev`, tablet 1024×768 + phone 390×844: pass 3 runs in a row after fixing a helper race (menu check ran before the console finished loading after `page.reload()`). New step: phone opens the drawer, Esc closes it, focus returns to "Buka menu".
- Static host (preview mode): sidebar on tablet, drawer on phone, "Mode pratinjau" shown, no Keluar, no page errors. English locale shows translated menu.

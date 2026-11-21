# Senior engineer — rebrand-pikul approach

- i18n is a source-string dictionary: changing an Indonesian key means changing the same key in `en.ts`; `npm run i18n:check` catches mismatches.
- `scripts/i18n-wrap.mjs` ignores the brand name; swap `KasirKu` → `Pikul` there.
- Landing `index.html` is generated: edit `scripts/landing/build.py`, then `python3 scripts/landing/build.py static`.
- Logo SVG from the brand kit geometry (viewBox 0 0 64 64 app icon); strip C2PA metadata only in inline JSX, keep files as delivered.
- e2e scripts match visible text ("Cara kerja KasirKu" etc.) — update them with the copy.

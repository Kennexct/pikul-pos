# Rebrand to Pikul — design (2026-11-20)

**Approved by Kenny:** name Pikul picked in the brand thread; "yes start the rename in the code" (2026-11-20).

## Goal
Every surface a seller, visitor or admin sees says **Pikul** with the new logo, without losing data on devices that already ran KasirKu, then a guide for renaming the GitHub repo and Cloudflare Pages project.

## Scope
- In: interface copy ID + EN, manifest, icons, favicon, logo component, landing page (generator + output), admin console, sign-in email, export/backup file names, JWT issuer, env example, README, MASTER.md, runbooks, e2e scripts, project instructions, tagline "Jualan ringan. Catatan beres." on the landing page.
- Out: storage identifiers (frozen, ADR-016), historical .10x records, new landing screenshots (they show the app UI, which has the logo only in the header — re-shoot later), domain purchase, trademark search.

## Success criteria
- `grep -ri kasirku` outside `.10x/` history and the frozen identifiers returns nothing user-visible.
- typecheck, i18n:check, unit tests, build pass; e2e scripts pass on phone + tablet.
- An installed v0.15 PWA keeps its sales after updating.

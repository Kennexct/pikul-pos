# ADR-016: Rebrand KasirKu to Pikul

**Status:** Accepted
**Date:** 2026-11-20
**Feature:** rebrand-pikul
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
"KasirKu" is already used by other products, so Kenny chose the new name **Pikul** (brand kit v1, `brand/pikul-brand-kit/`, guideline artifact "Pikul Brand Guidelines"). About 60 files mention KasirKu: interface copy, PWA manifest, landing page, admin console, emails, file names, docs. Some of those strings are not copy but **identifiers that already live outside the code**: the IndexedDB database name, localStorage keys, the `app` marker inside backup files. Renaming those would orphan a seller's data (offline-first: the device is the source of truth) or make old backups unreadable.

Nothing is deployed yet (v0.15), so server-only identifiers (JWT issuer, test domains) have no live state.

## Decision
1. **Everything a person can see says Pikul.** Interface copy (ID + EN), page titles, PWA manifest `name`/`short_name`, sign-in email, PDF footer, help articles, landing page, admin console, README and runbooks.
2. **Device and file identifiers stay `kasirku`, frozen.** Dexie DB name `kasirku`, localStorage keys `kasirku-cart`, `kasirku-lang`, `kasirku-active-member`, backup marker `app: "kasirku"` (`BACKUP_APP_ID`). They are invisible to sellers; each is commented as a legacy identifier that must not change without a migration.
3. **File names a seller downloads say pikul**: `pikul-cadangan-<toko>-<stamp>.json`, `pikul-<toko>-<from>_<to>.xlsx|csv|pdf`. Restore keeps accepting old `kasirku-cadangan-*.json` files because it checks the `app` marker, not the file name.
4. **Server identifiers change now**: access-pass JWT issuer `pikul` for new passes, while the app also accepts the legacy issuer `kasirku` in case a deployment already issued passes; package name `pikul`; example env `MAIL_FROM=Pikul <masuk@pikul.id>`, `APP_ORIGIN=https://pikul.pages.dev` (placeholders until the domain is chosen).
5. **Logo:** `LogoMark` becomes the Pikul app-icon mark (pandan tile, santan mark, kunyit head dot); wordmark is the text "Pikul" in Plus Jakarta Sans ExtraBold. One new token `--color-kunyit` is allowed **only** in the logo. PWA icons, apple-touch icon and favicon come from the brand kit.
6. PWA manifest `id` stays `/app/`, so installed apps update in place (new name and icon) instead of becoming a second app.
7. Historical records (old ADRs, specs, reviews) are not rewritten; they describe what was true at the time.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Rename every identifier incl. Dexie DB + storage keys, with a one-time migration | Fully clean codebase | Migration code on the sell path's DB open; any bug loses a seller's sales; extra tests for no user-visible gain | Risk without benefit; identifiers are invisible |
| Only change copy, keep all file names and server ids | Smallest diff | Downloaded files still say "kasirku", a visible leftover of the old brand | File names are seen by sellers and their accountants |
| Keep the name in one `APP_NAME` constant and interpolate everywhere | Next rename is one line | i18n keys become `t('Cara kerja {0}', APP_NAME)`; harder for translators; a rename is rare | Not worth the churn; constant kept for code use |

## Consequences
### Positive
- Sellers, landing visitors and emails see one brand; installed PWAs update in place.
- Zero data migration; existing devices and backups keep working.
### Negative
- The codebase keeps a few `kasirku` strings on purpose; a reader must know why (comments + this ADR).
### Risks
- Someone "finishes the rename" later and changes the Dexie name → data loss. Mitigation: comments next to each frozen identifier, listed in `design-system/MASTER.md` and this ADR.
- Name not trademark-cleared yet (PDKI classes 9 and 42) — business task for Kenny before launch.

## Dependencies
- Brand kit v1 (`/mnt/project-files/brand/`).
- Cloudflare Pages project name and domain (see `docs/runbooks/rename-cloudflare-github.md`).

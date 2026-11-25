# Recognisable devices (v0.19.7) — design

**Date:** 2026-11-25 · **Feature slug:** `device-names` · **ADR:** none (extends ADR-025's device list; two columns, one endpoint)
**Asked by Kenny:** "for sync device, it show up perangkat 1, perangkat 2, etc.. (then how can i know which perangkat im sign in? because some of the account im sign in using incognito web, then i cant continue again when the browser already closed) suggest me for this flow, any better solution?" → proposal in the project chat → "okay, build it".

## Problem
The device list in Pengaturan → Sinkronisasi named devices "Perangkat 1, 2…" by first appearance, so nobody could tell which one was which. Incognito windows lose their IndexedDB (device id, store copy) when closed, so every incognito sign-in left a dead "Perangkat N" behind and could not be "continued".

## Decisions
1. **Auto name** from the user agent: "Chrome · Android", "Safari · iPad", "Samsung Internet · Android", "Edge · Windows" (`lib/deviceLabel.ts`). iPadOS in desktop mode is told from a Mac by its touch screen. Two devices with the same auto name get " 2", " 3" by first appearance. The owner can still rename ("Kasir depan"); the auto name then shows on the second line.
2. **"Perangkat ini"** badge on this device, which is listed first; the others by most recently active.
3. **Last active** on every row ("Aktif 5 menit lalu"). Pull now also refreshes `last_seen` (throttled to once a minute in SQL), so a device that only reads still counts as active.
4. **Inactive flag** "Tidak aktif N hari" from 7 days without contact.
5. **Remove** another device (inline confirm, owner only since Settings is owner-gated). Store data is untouched. A device that is still in use reappears on its next sync, which is the honest behaviour given sessions are per account, not per device. The current device cannot remove itself (client hides it, server refuses `self`).
6. **Private window warning**: best-guess detection (`lib/privateWindow.ts`: Safari/Firefox refuse OPFS; Chromium quota < 2 × JS heap limit). A dismissible warn banner on the sign-in page and on top of the app, and a "Jendela penyamaran" badge on that device in every device list (sent in the hello as `privateMode`).
7. **Signing in again** on any browser needs no change: it is a new device and the store downloads from the account (ADR-025). The list's footnote and Help say so.

## Server and database
- Migration `006_device_names.sql`: `sync_devices.auto_name text`, `sync_devices.private_mode boolean`. Must run before deploying.
- Hello (`claim`, `push`, `replace`, and now `pull` query) carries `autoName` (≤40 chars, same character rules as names) and `privateMode`.
- `POST /api/sync/devices/remove {deviceId, self}` → 200 with the list, 400 `this_device`, 404 `not_found`.
- Apps before v0.19.7 pull with only `deviceId`: the server does not touch their row, so their receipt code is never blanked.

## Testing
Unit: `deviceLabel`, `privateWindow`, `lastActive`, server sync (auto names + duplicates, private flag, pull keeps last active, old-app pull, remove). e2e `v23.py` phone + tablet; `v19`, `v18`, `v21`, `v16`, `v22`, `flow` re-run.

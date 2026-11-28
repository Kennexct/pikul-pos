# ADR-029: Numbers are typed on an in-app keypad; sheets fit above the on-screen keyboard

**Status:** Accepted — Kenny chose "1 for number fields and 2 for text fields", then "Yes build it" (2026-11-28)
**Date:** 2026-11-28
**Feature:** keyboard-safe-sheets
**Author:** 10x-Team (Architect + PM)

## Context
On iPad Safari the on-screen keyboard is laid over the page; only `window.visualViewport` shrinks, `100dvh` and fixed elements do not. The weigh-out sheet ("Bayam / kg") ended up squeezed behind the keys with its field and "Tambah ke pesanan" hidden (Kenny's screenshot). Chrome on Android behaves the same by default (`interactive-widget=resizes-visual`). iPad also ignores `inputmode="decimal"` and shows the full keyboard.

## Decision
1. **Number fields inside sheets use an in-app keypad.** `Keypad` (3 × 4 keys, 48 px) sits in the sheet footer above the main button; the field keeps its `<input>` but gets `inputMode="none"`, so the system keyboard never opens while focus, caret, hardware keyboard, screen readers and Playwright `fill()` still work. `useKeypad` tracks which field the keypad types into; the first key after picking a field replaces it (like a selected field); a quick-pick chip restarts that. Bottom-left key: "," for weights, "000" for Rupiah, none for percent. Used in SaleEntry, Payment (cash), Discount, OpenRegister, CloseDay, Expense.
2. **Every `Sheet` fits above the keyboard.** `useKeyboardArea` follows `visualViewport` (resize + scroll); when more than 120 px is hidden at normal zoom, the sheet's overlay takes exactly the visible area, so the panel shrinks, its body scrolls, the footer button sits just above the keys, and the focused field is scrolled into view after the keyboard settles. QrisDisplay (full-screen, reference field at the bottom) uses the same hook.
3. Focusing a text field (a note) hides the keypad so the system keyboard takes over; tapping the number field again brings it back.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| `inputmode="decimal"` only | One attribute | iPad still shows the full keyboard over the sheet | Does not fix the reported case |
| `interactive-widget=resizes-content` meta | Android resizes the page | Ignored by Safari; moves the bottom tab bar on Android | Does not fix iPad |
| Read-only display + keypad (no `<input>`) | No keyboard ever, no iPad shortcut bar | Breaks hardware keyboards, `fill()` in 20+ e2e scripts, native a11y | `inputMode="none"` gives the same result on touch |
| Keypad on every number field app-wide (product form, settings) | One pattern | Full pages already scroll the field into view; big change | Sheets are where the keyboard hides the action; pages can follow later |

## Consequences
Positive: weighing, pricing and cash entry need no system keyboard on phone or tablet; nothing in a sheet can end up behind the keys; same muscle memory as the PIN pad. Negative: sheets with a keypad are taller (about 220 px); on a short phone the body scrolls more. Risk: iPadOS may still show its small shortcut strip for an `inputmode="none"` field; it is under 120 px, so the sheet ignores it and nothing is covered.

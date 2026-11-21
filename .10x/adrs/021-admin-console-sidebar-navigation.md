# ADR-021: Admin console navigation in a left sidebar

**Status:** Accepted
**Date:** 2026-11-21
**Feature:** admin-sidebar-nav
**Author:** 10x-Team (Architect + Staff Engineer)

## Context
ADR-020 gave `/admin/` seven sections in a horizontal tab bar. Kenny asked for the menu in a left navbar. Seven Indonesian labels overflow a tab bar on tablet and scroll sideways on a phone, and the console will grow.

## Decision
A fixed 240 px left sidebar on ≥ 768 px with two labelled groups (Bisnis; Situs & promosi). Below 768 px the same sidebar component opens as a left drawer from a menu button in a sticky top bar. Section state stays in React state + `sessionStorage`; no router is added.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Icon-only rail on phone | Always visible | Seven icons without labels are hard to tell apart | Labels matter for a business console |
| Keep tabs on phone, sidebar on tablet | Least change on phone | Two navigation models to maintain and test | Inconsistent |
| URL routes per section (react-router) | Deep links, back button | New dependency in the admin entry, more change | YAGNI now |

## Consequences
- Positive: room for more sections, clear grouping, wider content area on laptop.
- Negative: one more tap on a phone to switch section.
- Risks: e2e selectors change (`tab` → menu buttons); covered by updating `v17.py`.

## Dependencies
ADR-020 (sections). Next ADR: 022.

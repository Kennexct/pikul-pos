# ADR-027: Reopening the register the same day starts a new shift

**Status:** Accepted — Kenny chose "build it" (2026-11-25)
**Date:** 2026-11-25
**Feature:** open-register-shifts
**Author:** 10x-Team (Architect + PM)

## Context
"Tutup kasir" (ADR-007) was one closing per business day per device (ADR-026). A seller who closed at 14:05 and started selling again at 15:00 had two bad options: sell past the closing (the cashier warned once, "Tetap jual", and the closing went stale), or have the owner reopen the closed day and count it again at night. Both make the counted cash of the first stretch meaningless, and the day's cash was never really counted twice.

## Decision
- A business day on one device holds **shifts**, numbered from 1 (`DayClosing.shiftNo`, absent = 1 for records made before this change). A shift ends with its closing; `countedCash` and the report of a closed shift are final.
- Opening the register again the same day **always opens the next shift**. The closed shift is never continued. The cashier's banner reads "Shift 1 ditutup 14.05" with "Buka shift baru"; the sheet repeats it and prefills the opening cash with what the last shift counted, which the cashier can change.
- Records belong to a shift **by time**: after the previous closing's `closedAt`, up to their own. A sale counts when it was paid (`paidAt`), so a saved order paid in the next shift counts there.
- "Buka kembali" is a correction of the **last** closing and only while the next shift has not started (no opening typed, no sale). Once it has, the closing is locked.
- Kas shows the shift being viewed ("Kas laci · Shift 2"), a "Semua shift hari ini" card with every shift, its closing time, sales and difference, and the day's total (sales, transactions, expenses, difference). "Riwayat tutup" names the shift on days with more than one. The WhatsApp summary says "· Shift 2".
- Reports, history and the daily totals sent to the console stay store-wide and per day, so they already add up every shift.
- The register pop-up (ADR-020) still fires once a day, on the first shift.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Keep "Tetap jual" past a closing | No new concept | The closing goes stale; the count means nothing | What Kenny asked to replace |
| Reopen the closed day and count once at night | One count a day | Two cashiers' cash mixes; the first count is thrown away | Loses the handover |
| A shift per cashier (staff member) | Follows people | A cashier can switch devices; the drawer is physical (ADR-026) | The drawer belongs to the device |

## Consequences
Positive: a handover is counted and kept; each shift's difference is visible; the day still adds up. Negative: a day can hold several closings, so screens that name "the day's closing" name a shift instead. Risk: a device whose clock is far off places records in the wrong shift; the window uses the stored ISO times of that same device, so only a clock change mid-day can do it.

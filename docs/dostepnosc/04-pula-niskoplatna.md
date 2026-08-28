# Step 4 — Twoja pula na ten tydzień (niskopłatna weekly cap)

Niskopłatne tab only: progress bar "3 z 4", "Możesz wystawić 4 terminy
niskopłatne tygodniowo... Pula odnawia się w każdy poniedziałek."

## This is an already-documented rule, not a new one

`plan.md`: "Supply-side cap (4 low-pay slots/week/specialist) is enforced
when a specialist builds their own schedule — irrelevant to our
search/booking slice" — this screen is exactly where it becomes relevant.

## Reconcile with `REQUIRED_COMMUNITY_MINUTES`

`therapist-calendar.ts` separately enforces a **minimum** 300 min
(5h)/week combined niskopłatna+bezpłatna availability window
(`validateWeeklyAvailability`). The mockup's pula is a **maximum of 4 bookable
niskopłatna slots/week**, counted differently:

- the 300-min rule counts *open hours offered* (from step 1's rhythm)
- the pula counts *slots actually filled by patients* (bookings made against
  niskopłatna this week, not availability offered)

These aren't contradictory (open ≥5h of which at most 4 fill up as
niskopłatna specifically — presumably the rest can fill as bezpłatna or go
unbooked) but confirm this reading against the source spec PDFs
(`zakres-wdrozenia.pdf`) if/when available — not in this repo, referenced
only from `plan.md`. `plan.md` already flags one internal inconsistency in
those docs (10 vs 4 for a different limit), so don't assume the mockup's "4"
and the code's "300 min" definitely describe the same constraint without
checking.

## Data

Count = `appointments` where `practitioner_id = me`, `service_id =
niskoplatna`, status in (`held`,`confirmed`), `starts_at` within the current
Mon–Sun week (Warsaw time, `startOfWarsawWeek` already exists in
`therapist-calendar.ts`). Denominator (4) — global constant for now
(matches `plan.md`), not stored per-practitioner unless a later step needs it
configurable.

This is read-only display in the mockup (no editable control) — it's a
consequence of bookings, not a setting the practitioner adjusts here.

# Step 2 — Poprawki na konkretnych godzinach (hourly overrides)

7-day grid (grid is exactly 7 days because `MAX_SLOT_DAYS_AHEAD = 7` — the
mockup's own copy says this: "Siatka pokazuje 7 dni, bo tylko na tyle wolno
wystawiać terminy"), one column per day, one row per hour in the practitioner's
working window. Click an empty/rhythm cell to toggle a one-off change for
that single hour; booked cells (`zajęta przez pacjenta`) are not clickable.

Legend/cell states: from rhythm (pale blue, clickable to remove) · added
manually (green, an `open` exception) · removed/wyłączona (hatched, a
`closed` exception) · booked (solid, read-only — comes from `appointments`,
not from availability tables at all).

## Data

`calendar_exceptions`, one row per toggled hour:

- Removing an hour that came from the rhythm → insert
  `{date, kind: 'closed', service_id, start_time, end_time}` (start/end = that
  one hour).
- Adding an hour outside the rhythm → insert `{date, kind: 'open', ...}`.
- Clicking an already-toggled cell again → delete that exception row (revert
  to whatever the rhythm says for that hour).

This is the exact shape `slotStartsForDay()` in `src/lib/appointments.ts`
already consumes — the booking side is done, this step is only:
read the 7-day grid for one practitioner+service, and CRUD individual
exception rows.

## Server actions

- `getExceptionsGrid(practitionerId, serviceId, fromDate)` — 7 days of
  per-hour state, computed by combining `calendar_availability` (which hours
  the rhythm says are open) + `calendar_exceptions` (overrides) + booked
  `appointments` for those 7 days. Reuse `slotStartsForDay`'s logic/shape
  rather than reimplementing the overlap math — may be worth exporting a
  small "describe this day's hours with their source" variant of it instead
  of just the booking-facing start-times list.
- `toggleExceptionHour(practitionerId, serviceId, date, hour)` — insert or
  delete the one exception row, per the three cases above.

## Validation

`validateAvailabilityException` in `therapist-calendar.ts` already checks
date format, end > start, and no-overlap-with-existing-exception — reuse it,
but note it's currently typed for the leave/urlopy shape (whole exception has
one reason, no `kind`); check whether it fits per-hour toggles as-is or needs
a `kind` field added before reusing.

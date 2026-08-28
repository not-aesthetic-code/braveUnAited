# Step 1 — Tygodniowy rytm (weekly rhythm)

**This is the one we build first.**

## Prerequisite: the live null-scoped seed rows will break this

Verified live (2026-08-28): every practitioner's calendar currently has 7
`calendar_availability` rows with `service_id = null`, `09:00–17:00`, one per
`day_of_week` (the migration's original seed, replicating the old hardcoded
9–17-every-day-every-service behavior). `slotStartsForDay`'s
`forThisService` treats `service_id = null` as "matches every service", and
merges it with whatever this screen writes — so a practitioner narrowing
Monday to 15:00–20:00 pełnopłatna would still show 09:00–20:00 in the booking
flow, and nothing in this UI could remove the 09:00 slots, because the save
path only ever touches `(calendar_id, 'pelnoplatna')`/`(calendar_id,
'niskoplatna')` rows, never the null-scoped ones.

Fix, one-time, before step 1 ships: for each existing null-scoped row,
expand it into 5 explicit rows (one per `SERVICE_TYPES` entry: niskoplatna,
pelnoplatna, adhd_diagnoza, asystent_zdrowienia, bezplatna) with the same
day/start/end, then delete the null-scoped original. This is
booking-behavior-neutral (`forThisService` already matched all 5 services for
a null row — explicit rows for all 5 produce the identical `slotStartsForDay`
result) and makes this screen's per-`(calendar_id, service_id)` replace-all
correct. Apply as a one-off data migration via `psql` against
`POSTGRES_URL_NON_POOLING` (same approach used for the schema migrations
earlier today), not a schema change.

## UI

`/panel/dostepnosc` — new route, specialist-only (same auth pattern as
`/panel/page.tsx`: `getClaims()`, redirect to `/panel/login` if no
`practitioner_id`).

- Two tabs, "Konsultacje pełnopłatne" / "Konsultacje niskopłatne" — client
  tab state, both tabs' data loaded up front (server component fetches both
  service's availability rows once).
- Per tab: 7 day rows (Pon–Ndz). Each row: on/off toggle, one or more
  start/end time range inputs, a delete icon per range, "+ Zakres" to add
  another range to that day. Off day (Sobota/Niedziela in the mockup) shows
  greyed "Nie przyjmujesz w ten dzień." instead of inputs.
- Header badge "N terminów tygodniowo" — computed client-side from the
  ranges: `sum(floor((end-start)/(duration+buffer)))` per service, using that
  service's `duration_minutes`/`buffer_minutes` from `services`.
- "Zapisz harmonogram" — single save button for the whole page (both tabs),
  top right.

## Data

Maps directly onto `calendar_availability`:

```
calendar_id   — from calendars where practitioner_id = <me>
service_id    — the service id for the active tab (niskoplatna | pelnoplatna)
day_of_week   — 0=Sunday..6=Saturday (matches the check constraint; UI is Mon-first, convert)
start_time / end_time
```

One row per range shown. A day with two ranges (like Wtorek in the mockup) is
two rows with the same `day_of_week`.

## Server actions (`src/app/panel/dostepnosc/actions.ts`)

- `getWeeklyAvailability(practitionerId, serviceId)` → rows for that
  calendar+service, read via a new small query (don't reuse the booking-side
  `getCalendars()` — that fetches every practitioner for slot search, wrong
  shape/cost for a single-practitioner edit screen).
- `saveWeeklyAvailability(practitionerId, serviceId, ranges[])` — replace-all:
  delete existing `calendar_availability` rows for that
  `(calendar_id, service_id)` pair, insert the new set, in one transaction
  (Postgres function or two calls inside a Supabase transaction — check what's
  available; a delete+insert pair is fine for the hackathon timebox if true
  transactions are awkward here).

## Validation before save

Reuse `src/lib/therapist-calendar.ts`, don't re-derive:

- `validateWeeklyAvailability(ranges)` already checks: valid weekday,
  `serviceType` is `niskoplatna`/`bezplatna` only, end > start, no same-day
  overlap, and **minimum 300 min/week** (`REQUIRED_COMMUNITY_MINUTES`) for
  the community tab.
- ⚠️ that function's `serviceType` guard only accepts `niskoplatna`/
  `bezplatna` — it's written for the niskopłatna tab. The pełnopłatna tab
  needs the same overlap/ordering checks minus the service-type gate and
  minus the 300-min floor (pełnopłatna has no minimum in the mockup or in
  `plan.md`) — either loosen the function to take the checks it needs as
  flags, or write a thin pełnopłatna-specific wrapper that skips the two
  niskopłatna-only checks. Confirm which before writing it.
- `minutesOfEligibleAvailability` — feeds the "N terminów tygodniowo" badge
  math above.
- The 300-min floor: **warn, don't block save.** The mockup has no error
  state for this anywhere in the screen (checked both tabs, full scroll) —
  treat it as a soft nudge (banner/toast), not a save-blocking validation,
  unless the source spec says otherwise.

## Scope of what this screen writes

This screen only manages rows scoped to `pelnoplatna` and `niskoplatna`
specifically (the two tabs). After the prerequisite backfill above,
`adhd_diagnoza`/`asystent_zdrowienia`/`bezplatna` have their own explicit
rows too (still 09:00–17:00 every day, untouched by this screen) — so they
keep working exactly as today until a future screen manages them.

## Weekday numbering — three different conventions, don't mix them

- `calendar_availability.day_of_week`: **0 = Sunday .. 6 = Saturday**
  (matches `Date.prototype.getUTCDay()`, which is what
  `listAvailableSlots`/`slotStartsForDay` already use to compute it — see
  `appointments.ts:666`).
- `therapist-calendar.ts`'s `validateWeeklyAvailability`: **1 = Monday .. 7 =
  Sunday** (its own `range.weekday` check, unrelated to the DB column).
- `therapist-calendar.ts`'s `startOfWarsawWeek` internal map: **Mon = 0 ..
  Sun = 6** — a third scheme, used only for date arithmetic there, not stored
  anywhere.
- The UI is Mon-first (Poniedziałek…Niedziela, per the mockup). Convert once,
  at the UI/action boundary: UI Mon-first index `0..6` → DB `day_of_week` via
  `(uiIndex + 1) % 7`. If reusing `validateWeeklyAvailability`, convert again
  to its 1–7 Monday-first scheme (`uiIndex + 1`) — don't pass DB-shaped
  `day_of_week` values into it directly, they're a different number for every
  day except Monday.

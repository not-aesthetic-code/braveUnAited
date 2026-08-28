# `/panel/dostepnosc` — plan

Source: [makieta](https://fundacja-niepodzielni.github.io/gabinet-makieta/#/panel/dostepnosc)
(`fundacja-niepodzielni/gabinet-makieta`), screen "Dostępność" under Kalendarz
in the specialist sidebar. Already on the screen inventory in `plan.md` — this
just breaks it into buildable steps.

**Checked first: no screen/route exists yet.** `src/app/panel/` only has
`page.tsx` (the appointment list dashboard), `actions.ts`, and `login/`. No
`dostepnosc` route, no server actions for it.

There *is* a partial, unwired piece already in the repo, worth reusing rather
than duplicating: `src/lib/therapist-calendar.ts` (commit `adc04b0`, by
Lukasz) — weekly-availability validation, exception validation, and a
Warsaw-timezone month-grid builder, plus its own `.selfcheck.ts`. It has zero
importers anywhere else in `src/` — it reads like domain rules written ahead
of this exact screen, not yet wired to `calendar_availability`/
`calendar_exceptions` or any UI. Confirmed via `git log origin/main` that no
one else has since built the `dostepnosc` screen itself (the only unpulled
commits today were a design/style pass aligning `globals.css` etc. with this
same mockup's colors/type — already merged locally, see
`docs/superpowers/specs/2026-08-28-styl-referencja-gabinet-makieta-design.md`
for the token mapping this screen should just inherit for free).

## What the mockup shows, top to bottom

Two tabs — **Konsultacje pełnopłatne** / **Konsultacje niskopłatne** — each
with its own independent schedule (own weekly rhythm, own exceptions). Below
the tabs, one page per tab:

1. **Tygodniowy rytm** — day-of-week toggle + one or more time ranges per day,
   "+ Zakres" to add a second range on the same day (e.g. Wtorek has
   09:00–13:00 and 15:00–20:00). Header shows a computed "N terminów
   tygodniowo" count. → [01](./01-tygodniowy-rytm.md)
2. **Poprawki na konkretnych godzinach** — a 7-day hour grid (only 7 days,
   because that's the booking window). Click a cell to toggle it off (removes
   an hour that came from the weekly rhythm) or on (adds an hour outside the
   rhythm). One-time only, doesn't touch the rhythm. Booked cells are locked.
   → [02](./02-poprawki-godzinowe.md)
3. **Wolne i urlopy** — multi-day date-range closures, reason text, applies to
   *all* services/tabs at once, wins over everything else. Table of existing
   entries + "Dodaj wolne". → [03](./03-wolne-urlopy.md)
4. **Twoja pula na ten tydzień** (niskopłatne tab only) — "3 z 4", resets
   Monday. This is the existing documented supply-side cap. → [04](./04-pula-niskoplatna.md)
5. **Reguły, których nie zmieniasz** + validation copy (cross-tab overlap
   warning) — read-only global constants card. → [05](./05-reguly-i-walidacja.md)
6. **Kalendarz zewnętrzny** (Google Calendar sync) — out of scope for now.
   → [06](./06-poza-zakresem.md)

## Why steps 1–2 cost (almost) nothing

`calendar_availability` and `calendar_exceptions` — built during the
Practitioner/Patient/Calendar schema work — already model exactly this:

```
calendar_availability(calendar_id, service_id?, day_of_week, start_time, end_time)
calendar_exceptions(calendar_id, service_id?, date, kind: closed|open, start_time?, end_time?)
```

`service_id` null = both tabs at once; non-null scopes to one tab. A "closed"
exception with null start/end = whole day off (used by step 3). The read side
(`getCalendars` + `slotStartsForDay` in `src/lib/appointments.ts`) already
implements the closed/open/service-scoping semantics for the *booking* flow —
step 1–2 is: expose read+write of these same rows to the practitioner, in
their own panel screen. No schema migration needed for steps 1–2, but step 1
does need a one-time **data** backfill first (see
[01](./01-tygodniowy-rytm.md#prerequisite-the-live-null-scoped-seed-rows-will-break-this)
— live `calendar_availability` still has the original null-scoped seed rows,
which would silently union with anything this screen saves). Step 3 needs one
small additive column (`calendar_exceptions.reason`) — see
[03](./03-wolne-urlopy.md).

## Order

Doing 1 first, per instruction — it's the highest-value 90% case per the
mockup's own copy ("rytm tygodniowy... odpowiada za 90% terminów"). 2 and 3
build on the same tables. 4–6 are smaller/separate and can slot in later.

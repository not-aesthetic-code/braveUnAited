# Step 5 — Reguły, których nie zmieniasz + cross-tab warning

Small, mostly-copy work once 1–3 exist.

## Read-only rules card

All six values already exist as constants — this card just displays them,
doesn't edit them:

| Mockup label | Source |
|---|---|
| Przerwa między wizytami: 10 minut | `services.buffer_minutes` (per-service; card shows one value — confirm which service's buffer to show, or whether it's actually a global constant elsewhere) |
| Najbliższy możliwy termin: 2 h od teraz | `MIN_LEAD_HOURS` in `appointments.ts` |
| Wystawiasz terminy na: 7 dni do przodu | `MAX_SLOT_DAYS_AHEAD` in `appointments.ts` |
| Bezpłatne odwołanie: do 24 h przed | `CANCEL_WINDOW_HOURS` in `appointments.ts` |
| Strefa czasowa: Europe/Warsaw | `calendars.timezone` for this practitioner |
| Kalendarz pacjenta otwarty na: 30 dni | not found in current code — new concept, or same as `MAX_SLOT_DAYS_AHEAD`+something on the `/konto` side; check before building |

## Cross-tab overlap warning

"Wtorek 9:00–13:00 masz w dwóch kalendarzach... To dozwolone... rezerwacja w
jednym natychmiast zamknie go w drugim." — informational banner, not a
blocker. Computed client-side after both tabs' rhythms are loaded: for each
day, check whether pełnopłatna and niskopłatna ranges overlap; list the
overlapping windows. Purely derived from step 1's data, no new
reads/writes.

# Step 3 — Wolne i urlopy (leave)

Table: OD / DO / POWÓD / WIZYTY W TYM CZASIE ("brak kolizji" or "N do
przełożenia") / Zmień. "+ Dodaj wolne" opens a form (date range + reason).
Copy: "Wyjątek wygrywa ze wszystkim — z rytmem i z ręcznymi poprawkami.
Dotyczy wszystkich Twoich usług naraz." — i.e. this is cross-service (both
tabs), unlike steps 1–2 which are per-service.

## Data

One small schema change: add a nullable `reason text` column to
`calendar_exceptions` (`alter table calendar_exceptions add column reason
text;` — additive, safe to apply live like the earlier migrations). No new
table, no sync job.

A leave range `[from, to]` = one `calendar_exceptions` row **per date** in
the range, each `{date, kind: 'closed', service_id: null, start_time: null,
end_time: null, reason}` (null service = both tabs; null start/end = whole
day, per the existing check constraint `kind = 'closed' or start_time is not
null`). These rows *are* the source of truth — no separate `leaves` table —
which keeps the slot-search read path (`slotStartsForDay`) working against
them unchanged.

For the UI table (one row per leave, not per day) and the "Zmień" edit
action: group the per-date rows back into ranges by `(reason, kind)` +
contiguous `date` — same `calendar_id`, same `reason`, dates with no gaps.
Editing a leave = delete its date rows, insert the new range's date rows.
Simpler than it sounds given leave ranges are short (days, not months) and
this is a low-traffic admin screen, not a hot read path.

## "Wizyty w tym czasie" collision check

Query `appointments` for that practitioner in `[from, to]` with status in
(`held`, `confirmed`) → count. Zero → "brak kolizji" (green). Non-zero → "N do
przełożenia" (amber) — mockup doesn't show what "Zmień" does with existing
collisions; likely needs a reschedule/notify flow, which is bigger than this
step. For a first pass: block save (or require explicit confirmation) when
collisions exist, don't build the reschedule flow yet.

## Order relative to steps 1–2

Independent of them (own table/section, own "wins over everything" rule
already respected by `slotStartsForDay`'s existing closed-exception handling
— a null-service closed exception already filters both tabs correctly today).
Can be built in parallel with step 2 rather than strictly after it.

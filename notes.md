# Cancellation flow (24h window) — progress notes

Source: product spec from Fundacja Niepodzielni describing patient-side
appointment cancellation, with different behavior before/after the 24h
free-cancellation deadline, plus practitioner-side no-show handling.

## Baseline (already existed before this work)

- `CANCEL_WINDOW_HOURS = 24`, `canManage()` in `src/lib/appointments.ts`
  already gated `canCancel`/`canReschedule` on the 24h window.
- Patient cancel within the window already set `payment_status: refund_due`
  (100% — no partial refunds in this system).
- Cancelled slots already freed immediately (`listAvailableSlots` excludes
  `status = cancelled`).
- `AppointmentStatus` already included `no_show`, but nothing in the app
  ever set it — no doctor-side UI existed to mark a no-show at all.

## Done (patient side — `src/app/my-booking/[id]/`)

- ">24h left" copy: "Możesz jeszcze bezpłatnie zmienić lub odwołać — masz na
  to czas do [data], godz. [godzina]." — deadline computed via new
  `cancelDeadline()` helper in `appointments.ts`.
- "<24h left" copy: "Minął czas na bezpłatną zmianę…" plus a **"Napisz do
  specjalisty"** mailto button (needs `practitioners.email` — see migration
  below).
- Cancel form now shows the refund summary before confirming (paid amount,
  refund amount, 100%, "zwykle w 3–5 dni roboczych", slot frees immediately)
  and an **optional cancellation reason** dropdown (choroba / kolizja z
  obowiązkami / nie potrzebuję już wizyty) with a note on who sees it
  (foundation aggregate stats; practitioner only on their own appointment).
- `cancelAppointment()` extended to accept and store the reason
  (`appointments.cancel_reason`).
- Self-check (`appointments.selfcheck.ts`) extended to assert the reason is
  stored and `cancelDeadline()` math.

Status: **implemented, not yet re-verified** — needs a re-read after the
migration below is applied (self-check currently fails against the live DB
because `cancel_reason`/`practitioners.email` don't exist yet — see below).

## In progress / blocked (doctor side)

- Added `markNoShow(id, practitionerId, fullRefund, now)` to
  `appointments.ts`: ownership check, only allowed once `startsAt <= now`,
  and a `fullRefund` flag that — when set by the practitioner — treats the
  no-show exactly like a patient cancellation (`status: cancelled`,
  `payment_status: refund_due`), matching the spec's "specialist can treat
  this as a cancellation with full refund" exception. Otherwise sets
  `status: no_show` and leaves `payment_status` untouched (counts toward the
  specialist's settlement).
- Wired a "Zgłoś nieobecność" action + "Potraktuj jako odwołanie z pełnym
  zwrotem" checkbox into `src/app/panel/page.tsx` / `actions.ts`.

**This collided with a concurrent `git rebase -i`** (rebasing `7ec080e` onto
`714e565`) that turned out to already contain a `feat: track appointment
attendance (completed/no_show)` commit doing an overlapping thing (via
`markAttendance()` / `isPastAppointment()` / `ATTENDANCE_GRACE_HOURS`,
different naming than my `markNoShow()`/`fullRefund`). Conflict markers
landed in `src/lib/appointments.ts`, `appointments.selfcheck.ts`,
`src/app/panel/page.tsx`, `src/app/panel/actions.ts`. Per your call, you're
resolving that rebase yourself — I stopped touching those four files and
git entirely.

**Next step once the rebase is resolved:** re-read those four files, check
whether the existing `markAttendance()` already covers "mark no-show" (it
looks like it might — `completed`/`no_show` outcomes), and if so, only add
what's still missing: the practitioner's **"treat as full-refund exception"**
checkbox, which `markAttendance()` doesn't appear to have. Avoid
reimplementing attendance marking from scratch.

## New migration (untouched by the rebase, still pending)

`supabase/migrations/20260828170000_cancellation_details.sql`:
- `appointments.cancel_reason` (nullable, checked against the 3 reason values)
- `practitioners.email` (backfilled for spec-1/2/3)
- `scripts/seed-doctors.ts` updated to read `practitioners.email` instead of
  deriving it from the name (single source of truth), falling back to the
  old derivation if unset.

**Not yet applied to the live Supabase project** — I only have
`SUPABASE_SERVICE_ROLE_KEY`, not DB credentials, so I can't run
`supabase db push` myself. You'll need to apply it the same way the earlier
migrations were applied, then rerun the self-check.

## Explicitly out of scope so far

The spec's step 7 (freed-slot waitlist, simultaneous email+SMS offer, and a
credit for the patient who cancelled late if the slot gets rebooked) is a
separate, much larger feature: no waitlist signup surface exists anywhere in
the app today, and there's no email-sending infra (only the SMS stub in
`src/lib/sms.ts`). Flagging it rather than half-building it — say the word
if you want it scoped out next.

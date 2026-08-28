# Progress log

Running log for the day. Add a line when you push, especially over the lunch break
(14:00-14:45) — the guidebook's move is: hand the agent "go through the demo, fix
what's broken, log changes here" while the team eats, then review on return.

Format: `HH:MM  who  what changed`

## 2026-08-27 (prework)

- 20:40  setup  Repo scaffolded: Next.js + TypeScript + Tailwind v4 + shadcn/ui, deployed to Vercel.

## 2026-08-28 (hackathon day)

<!-- add entries below as you push -->
- optional patient account: `/konto/login` (email magic link + Google SSO via Supabase), `/konto` lists bookings by email, `/auth/callback` exchanges the code. Guest `/my-booking/[id]` flow unchanged. Google SSO needs the provider enabled in the Supabase dashboard (client id/secret) — not something code can do.
- data model: `specialists` → `practitioners` (table rename only — `app_metadata.specialist_id` on doctor accounts is untouched on purpose, don't rename that key). New `patients` (dedup by phone), `services` (was hardcoded constants), `practitioner_services`, `calendars` + `calendar_availability` + `calendar_exceptions` (per-practitioner working hours, service-scoped, with closed/open date exceptions). `listAvailableSlots` now reads hours/duration/price from the DB and does timezone-correct slot math instead of assuming the server runs in Europe/Warsaw.
- 12:5x  migration **applied to the live Supabase project** (`practitioners`/`patients`/`services`/`practitioner_services`/`calendars`/`calendar_availability`/`calendar_exceptions` now exist, schema cache reloaded). All 10 pre-existing appointments were preserved through the backfill. If your local `/panel` login breaks, rerun `pnpm seed:doctors` — the `practitioners` table it reads from was just renamed.
- attendance tracking: `completed`/`no_show` were defined on `AppointmentStatus` but nothing ever set them — past visits stayed "confirmed" forever. Added `markAttendance()` + two buttons in `/panel` ("Wizyta się odbyła" / "Pacjent się nie zjawił"), gated to the logged-in practitioner's own appointments and only once a session has started. Unmarked visits now auto-settle to "completed" `ATTENDANCE_GRACE_HOURS` (48h) after they end, same lazy-expiry pattern as held-slot cleanup — no cron needed. Also fixed `getPatientsToRemind`, which was (accidentally) relying on visits never leaving "confirmed" — it now matches `confirmed` OR `completed`, otherwise auto-completed visits would silently drop out of the 6-week outreach list.
- phone validation: `patients.phone` is the dedup key (and `unique` in the DB) but accepted any string — "600 123 456" and "600-123-456" from two bookings silently created two patient rows. New `src/lib/phone.ts` (`normalizePolishPhone`, own DB-free `phone.selfcheck.ts`) hardcodes `+48` (every patient is Polish — no reason to detect a country code) and rejects anything that isn't 9 digits; wired into `upsertPatientByPhone` in `appointments.ts`, which now throws a Polish error message for an invalid number instead of inserting it. `/book`'s phone field now shows a fixed "+48" prefix next to the input instead of typing the code in.

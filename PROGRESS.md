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
- data model: `specialists` → `practitioners` (table rename only — `app_metadata.specialist_id` on doctor accounts is untouched on purpose, don't rename that key). New `patients` (dedup by phone), `services` (was hardcoded constants), `practitioner_services`, `calendars` + `calendar_availability` + `calendar_exceptions` (per-practitioner working hours, service-scoped, with closed/open date exceptions). `listAvailableSlots` now reads hours/duration/price from the DB and does timezone-correct slot math instead of assuming the server runs in Europe/Warsaw. **Needs `supabase db push` + rerun `pnpm seed:doctors` + `pnpm seed:appointments`** before the app works against a live project — not applied from this session (no `.env.local`/Supabase creds available here).

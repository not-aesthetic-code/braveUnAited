# Therapist Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Supabase-backed public demo panel for one therapist whose shell matches the supplied Fundacja Niepodzielni mockup and whose calendar supports week/month views, appointment details, recurring low-cost/free availability, and absence exceptions.

**Architecture:** Keep all database access in server-only modules using the existing Supabase service client. Add focused pure calendar/availability functions for deterministic testing, a therapist data-access layer for scoped reads and writes, and Client Components only for interactive presentation. Preserve the patient UI while making its slot generator respect the therapist's stored availability and exceptions.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5, Tailwind CSS 4, Base UI/shadcn primitives, Supabase Postgres and `@supabase/supabase-js` 2.112.

**Spec:** `docs/superpowers/specs/2026-08-28-therapist-calendar-design.md`

## Global Constraints

- The therapist shell must closely match the supplied Fundacja Niepodzielni therapist-panel mockup.
- Only the therapist module and shared availability read path may change; patient-facing visual design remains unchanged.
- The panel is public and fixed to one demo specialist; do not add authentication.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or raw server records to client code.
- Cancelled appointments are excluded by server queries.
- A saved recurring template requires at least 300 combined minutes of `niskoplatna` and `bezplatna` availability.
- Availability edits and absence exceptions never cancel or move existing appointments.
- Calendar business time is `Europe/Warsaw`.
- All new exposed-schema tables have RLS enabled with no browser-facing policies.
- Preserve unrelated working-tree edits in `.gitignore` and `pnpm-workspace.yaml`.

---

### Task 1: Pure availability and calendar domain logic

**Files:**
- Create: `src/lib/therapist-calendar.ts`
- Create: `src/lib/therapist-calendar.selfcheck.ts`

**Interfaces:**
- Produces: `WeeklyAvailabilityInput`, `AvailabilityExceptionInput`, `CalendarAppointment`, `validateWeeklyAvailability(ranges)`, `validateAvailabilityException(input, existing)`, `minutesOfEligibleAvailability(ranges)`, `startOfWarsawWeek(date)`, `buildMonthDays(anchor)`, and overlap helpers.
- Consumes: existing `ServiceType` and `AppointmentStatus` from `src/lib/appointments.ts`.

- [ ] **Step 1: Write failing self-checks for the five-hour rule and range validation**

Add executable assertions covering 299-minute rejection, exactly 300-minute success across both eligible service types, same-day overlap rejection, end-before-start rejection, and overlapping exception rejection.

```ts
assert.equal(minutesOfEligibleAvailability(validMixedRanges), 300)
assert.equal(validateWeeklyAvailability(validMixedRanges).ok, true)
assert.equal(validateWeeklyAvailability(tooShortRanges).ok, false)
assert.equal(validateWeeklyAvailability(overlappingRanges).ok, false)
```

- [ ] **Step 2: Run the self-check and confirm it fails because the module does not exist**

Run: `pnpm exec tsx src/lib/therapist-calendar.selfcheck.ts`

Expected: FAIL with an unresolved `./therapist-calendar` import.

- [ ] **Step 3: Implement typed validation and duration helpers**

Use integer ISO weekdays `1..7`, `HH:mm` local wall times, a strict eligible-service union, and Polish validation messages. Reject cross-midnight ranges rather than inferring the next day.

- [ ] **Step 4: Add failing checks for Warsaw week/month transformations and DST boundaries**

Cover a Monday start, a month beginning midweek, a date around Europe/Warsaw daylight-saving changes, and selection of a month day into its containing week.

- [ ] **Step 5: Implement calendar transformation helpers without third-party date packages**

Use `Intl.DateTimeFormat` with `timeZone: "Europe/Warsaw"` and centralized conversion helpers. Keep browser rendering data serializable.

- [ ] **Step 6: Run the focused self-check**

Run: `pnpm exec tsx src/lib/therapist-calendar.selfcheck.ts`

Expected: all assertions pass and the script prints `therapist calendar self-check passed`.

- [ ] **Step 7: Commit the domain slice**

```bash
git add src/lib/therapist-calendar.ts src/lib/therapist-calendar.selfcheck.ts
git commit -m "feat: add therapist calendar domain rules"
```

### Task 2: Supabase schema, seed data, and therapist data access

**Files:**
- Create: `supabase/migrations/20260828010000_therapist_calendar.sql`
- Create: `src/lib/supabase-server.ts`
- Create: `src/lib/therapist-data.ts`
- Create: `src/lib/therapist-data.selfcheck.ts`
- Modify: `src/lib/appointments.ts`

**Interfaces:**
- Produces: `DEMO_SPECIALIST_ID`, `getTherapistCalendarData(range)`, `getAppointmentDetailsForTherapist(appointmentId)`, `replaceWeeklyAvailability(ranges)`, `createAvailabilityException(input)`, `listAvailabilityForSlotSearch(serviceType, range)`.
- Consumes: Task 1 validation types and existing appointment row mapping.

- [ ] **Step 1: Discover the installed Supabase CLI workflow**

Run: `pnpm exec supabase --version` and `pnpm exec supabase migration new --help`.

If no local CLI exists, create the migration using the repository's existing timestamp convention and record that CLI migration generation was unavailable; do not install an unrequested global tool.

- [ ] **Step 2: Write the migration**

Create `specialists`, `weekly_availability`, and `availability_exceptions` with checks, foreign keys, indexes, `created_at`/`updated_at`, and RLS enabled. Add a private transactional Postgres function that replaces a specialist's weekly template only after checking range validity, overlap, and 300 eligible minutes. Revoke default function execution and grant only `service_role`.

- [ ] **Step 3: Add idempotent demo rows**

Insert the fixed specialist, a valid recurring schedule, and stable example appointments with fixed UUIDs. Include confirmed, held, completed, no-show, and cancelled records; ensure at least one repeated patient identity and use conflict-safe inserts.

- [ ] **Step 4: Extract the server-only Supabase singleton**

Move client creation from `appointments.ts` into `src/lib/supabase-server.ts`, add `import "server-only"`, validate environment variables with an actionable error, and export a single `getSupabaseAdmin()` function.

- [ ] **Step 5: Write failing data-access self-checks**

Test that therapist reads exclude cancelled rows, are scoped to `DEMO_SPECIALIST_ID`, return only approved patient detail fields, and surface a typed error when Supabase is unavailable.

- [ ] **Step 6: Implement therapist queries and mutations**

Select explicit columns, never `select("*")` for client-bound results. Re-read appointment ownership by fixed specialist inside detail queries. Return serializable view models rather than raw Supabase rows.

- [ ] **Step 7: Verify schema security and queries against configured Supabase**

Run the applicable local/MCP advisor and migration-list commands discovered in Step 1. Then run `pnpm exec tsx src/lib/therapist-data.selfcheck.ts` with the configured environment.

Expected: migrations apply, RLS is enabled, no public policies expose patient data, and all self-checks pass. If environment access is missing, keep pure tests passing and report integration verification as unavailable.

- [ ] **Step 8: Commit the persistence slice**

```bash
git add supabase/migrations src/lib/supabase-server.ts src/lib/therapist-data.ts src/lib/therapist-data.selfcheck.ts src/lib/appointments.ts
git commit -m "feat: persist therapist availability and demo calendar"
```

### Task 3: Make patient slot search respect therapist availability

**Files:**
- Modify: `src/lib/appointments.ts`
- Modify: `src/lib/appointments.selfcheck.ts`

**Interfaces:**
- Consumes: `listAvailabilityForSlotSearch()` from Task 2.
- Preserves: `listAvailableSlots(serviceType, now): Promise<Slot[]>` used by existing patient pages.

- [ ] **Step 1: Add failing regression checks**

Cover a recurring slot that is offered, a time outside the recurring template that is absent, an exception-blocked slot that is absent, and an existing appointment overlap that remains absent.

- [ ] **Step 2: Run the appointment self-check and observe the new failures**

Run: `pnpm exec tsx src/lib/appointments.selfcheck.ts`

Expected: FAIL on availability/exception assertions before implementation.

- [ ] **Step 3: Replace the hard-coded 09:00–17:00 generator inputs**

Generate candidate slots only from the selected specialist's stored weekly ranges for the requested service. Subtract exceptions and all active appointment time ranges. Preserve the 2-hour lead time, duration rules, buffers, seven-day patient horizon, and existing patient-facing return shape.

- [ ] **Step 4: Run both domain self-checks**

Run: `pnpm exec tsx src/lib/appointments.selfcheck.ts && pnpm exec tsx src/lib/therapist-calendar.selfcheck.ts`

Expected: both scripts pass.

- [ ] **Step 5: Commit the patient integration slice**

```bash
git add src/lib/appointments.ts src/lib/appointments.selfcheck.ts
git commit -m "feat: apply therapist availability to booking slots"
```

### Task 4: Build the mockup-matched therapist shell and calendar views

**Files:**
- Create: `src/app/panel/layout.tsx`
- Create: `src/app/panel/page.tsx`
- Create: `src/app/panel/error.tsx`
- Create: `src/app/panel/loading.tsx`
- Create: `src/app/panel/therapist-shell.tsx`
- Create: `src/app/panel/calendar/therapist-calendar.tsx`
- Create: `src/app/panel/calendar/week-view.tsx`
- Create: `src/app/panel/calendar/month-view.tsx`
- Create: `src/app/panel/calendar/appointment-dialog.tsx`
- Create: `src/app/panel/panel.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: serializable calendar data and appointment detail view models from Task 2 plus Task 1 date helpers.
- Produces: public `/panel` with accessible week/month interaction and details modal.

- [ ] **Step 1: Capture the mockup's therapist shell tokens and structure**

Document the observed sidebar width, green/navy/neutral palette, spacing, borders, radii, typography scale, desktop layout, and mobile collapse directly in `panel.css` variables and component structure. Do not import the mockup bundle or copy its unrelated patient/coordinator code.

- [ ] **Step 2: Build the Server Component page with a streaming boundary**

Load the fixed therapist's current calendar range server-side. Wrap uncached Supabase reads in `Suspense` as required by Next.js 16.3 guidance. Render a clear error/retry state through `error.tsx`.

- [ ] **Step 3: Build the shell and responsive navigation**

Match the mockup's therapist identity area, sidebar navigation, active state, header hierarchy, cards, badges, buttons, and responsive behavior. Keep unrelated nav entries visually present only when they exist in the supplied therapist shell, but link unfinished entries to inert/disabled states rather than inventing features.

- [ ] **Step 4: Implement the week view**

Render a semantic grid with weekday headers, hour labels, appointment blocks positioned by start/duration, and neutral absence blocks. Appointment buttons must be keyboard reachable and include patient, service, date, and time in their accessible label.

- [ ] **Step 5: Implement the month view and navigation**

Render complete calendar weeks, daily counts and compact visit entries. Selecting a day switches to the containing week. Add previous, next, `Dzisiaj`, and week/month controls.

- [ ] **Step 6: Implement appointment details**

Use the existing Base UI dialog primitives. Show only approved contact, appointment, payment-status, and concise history fields. Both the appointment block and patient-name control open the same modal.

- [ ] **Step 7: Add UI transformation self-checks where logic is non-visual**

Extend `therapist-calendar.selfcheck.ts` for event placement, month aggregation, and cancelled-item exclusion. Avoid brittle class-name snapshots.

- [ ] **Step 8: Verify the calendar slice**

Run: `pnpm exec tsx src/lib/therapist-calendar.selfcheck.ts && pnpm lint`

Expected: self-check passes and ESLint reports no errors.

- [ ] **Step 9: Commit the calendar UI slice**

```bash
git add src/app/panel src/app/layout.tsx src/lib/therapist-calendar.selfcheck.ts
git commit -m "feat: build therapist calendar panel"
```

### Task 5: Build recurring availability and absence workflows

**Files:**
- Create: `src/app/panel/dostepnosc/page.tsx`
- Create: `src/app/panel/dostepnosc/availability-editor.tsx`
- Create: `src/app/panel/actions.ts`
- Create: `src/app/panel/calendar/absence-dialog.tsx`
- Modify: `src/app/panel/calendar/therapist-calendar.tsx`
- Modify: `src/app/panel/panel.css`

**Interfaces:**
- Consumes: Task 2 query/mutation functions and Task 1 validation types.
- Produces: `saveWeeklyAvailabilityAction(previousState, formData)` and `createAvailabilityExceptionAction(previousState, formData)` returning constrained Polish success/error states.

- [ ] **Step 1: Add failing action-level validation checks**

Exercise malformed `FormData`, fewer than 300 minutes, overlap, a valid mixed 55/free schedule, invalid exception time, and overlapping exceptions without requiring React rendering.

- [ ] **Step 2: Implement Server Actions as public-demo trust boundaries**

Hard-code the demo specialist on the server; never accept specialist identity from the browser. Parse and validate all form data, call Task 2 mutations, use `revalidatePath("/panel")` and `revalidatePath("/panel/dostepnosc")`, and return only UI-safe state.

- [ ] **Step 3: Build the recurring editor**

Render weekday rows with add/remove ranges, time inputs, and a `55 zł`/`Darmowe` selector. Show a live combined duration meter and disable submission below 300 minutes while retaining authoritative server validation. Preserve submitted values after errors with `useActionState`.

- [ ] **Step 4: Build absence creation from the calendar**

Add an `Oznacz nieobecność` action that opens a date/time/reason dialog. Display server conflicts and appointment warnings. Refresh calendar data after success without claiming that appointments were cancelled.

- [ ] **Step 5: Verify workflow and accessibility**

Keyboard-test dialog open/close, range addition/removal, labels, focus states, error announcements, and responsive layout. Run focused self-checks and lint.

- [ ] **Step 6: Commit the availability UI slice**

```bash
git add src/app/panel src/lib/therapist-calendar.selfcheck.ts
git commit -m "feat: manage therapist availability and absences"
```

### Task 6: Full verification and project handoff

**Files:**
- Modify: `PROGRESS.md`
- Modify only if required by verified failures: files from Tasks 1–5.

**Interfaces:**
- Verifies every requirement in the approved spec.

- [ ] **Step 1: Run all focused self-checks**

Run: `pnpm exec tsx src/lib/therapist-calendar.selfcheck.ts && pnpm exec tsx src/lib/appointments.selfcheck.ts`

Expected: both pass with zero failed assertions.

- [ ] **Step 2: Run static verification**

Run: `pnpm lint && pnpm build`

Expected: both commands exit 0.

- [ ] **Step 3: Start the application and smoke-test both modules**

Run: `pnpm dev`, then verify `/panel`, `/panel/dostepnosc`, `/`, `/book`, and an existing `/my-booking/[id]` path. Confirm week/month navigation, detail modal, five-hour validation, exception creation, and unchanged patient visual flow.

- [ ] **Step 4: Compare the therapist shell visually against the supplied mockup**

Check desktop and narrow viewport screenshots side by side. Correct material differences in shell layout, palette, typography, spacing, components, and responsive behavior while retaining the approved custom calendar behavior.

- [ ] **Step 5: Review database security**

Confirm RLS on all new public tables, no `anon`/`authenticated` patient-data policies, no service key in client bundles, scoped specialist queries, and revoked execution on any privileged function.

- [ ] **Step 6: Update the project progress log**

Add one concise line to `PROGRESS.md` describing the therapist panel, calendar, Supabase availability, and verification results.

- [ ] **Step 7: Inspect the final diff and commit verification updates**

Run: `git status --short`, `git diff --check`, and `git diff --stat HEAD~5..HEAD`. Confirm unrelated `.gitignore` and `pnpm-workspace.yaml` edits remain untouched.

```bash
git add PROGRESS.md
git commit -m "docs: log therapist calendar delivery"
```

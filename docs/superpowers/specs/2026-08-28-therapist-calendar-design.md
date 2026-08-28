# Therapist Calendar Design

## Goal

Build a public demonstration panel for one example psychologist/psychotherapist. The panel follows the visual language and navigation of the Fundacja Niepodzielni mockup while replacing its therapist calendar with a functional week/month calendar backed by Supabase.

The work is limited to the therapist module and the shared availability read path required to prevent patients from booking blocked time. Existing patient screens and flows must otherwise remain unchanged.

## Demonstration Scope

- The panel is publicly accessible at `/panel`.
- There is one fixed example therapist and no therapist authentication.
- Supabase is the persistent data source.
- The Supabase service-role key remains server-only.
- The system includes deterministic example appointments so the calendar is useful immediately in a demo.
- Cancelled appointments are never displayed in the therapist calendar.
- There is no standalone patient profile or clinical documentation module.

## Visual Direction and Navigation

The therapist panel must visually match the therapist area of the supplied Fundacja Niepodzielni mockup as closely as practical. Reproduce its complete panel shell rather than merely borrowing its general style: sidebar dimensions and navigation, top-level page structure, therapist identity treatment, typography hierarchy, color tokens, borders, radii, shadows, spacing rhythm, cards, buttons, form controls, badges, empty states, and responsive behavior.

The intentional visual and behavioral departures from the supplied mockup are limited to the calendar, recurring-availability editor, absence controls, appointment details, and the other calendar behavior explicitly defined in this specification. Those areas use the same design system and shell but implement the newly agreed functionality. Do not redesign unrelated therapist-panel elements, and do not reproduce or modify patient or coordinator modules.

The panel contains:

- a therapist header/sidebar identifying the example specialist;
- a calendar page with week and month modes;
- an availability editor for the recurring weekly schedule;
- controls for creating date-specific absence exceptions.

The week view is the default. It presents hours vertically and weekdays as columns. Appointment blocks show start time, patient name, and abbreviated service name. Service categories have distinct but accessible colors. Therapist absence is shown as a neutral blocked-time element and must not resemble an appointment.

The month view shows short appointment entries and the number of appointments per day. Selecting a day switches to the week containing that day. Both modes provide previous/next navigation and a `Dzisiaj` action.

## Appointment Details and Patient Access

Selecting either an appointment block or its patient name opens an in-context details modal. The therapist may see only:

- patient name, email, and phone already associated with the appointment;
- appointment service, date, time, format, status, and payment status;
- a concise history of the same patient's earlier appointments.

The modal must not expose card data, session notes, therapeutic notes, diagnosis data, uploaded documents, or any broader patient profile. Patient identity for the demo is matched using the contact information already present on appointments. This is demo behavior, not a durable patient-identity model.

## Recurring Availability Rule

The therapist manages a recurring weekly availability template. Every saved template must contain at least 300 total minutes assigned to either:

- `niskoplatna` appointments priced at 55 PLN; or
- `bezplatna` appointments priced at 0 PLN, labelled `Darmowe` in the therapist interface.

The 300-minute requirement is combined across these two categories. The therapist chooses the weekday and time ranges and can change them later. The UI displays a live counter such as `4 h 00 min / wymagane 5 h`, but the minimum is also enforced on the server.

Saving must reject:

- a combined eligible duration below 300 minutes;
- ranges whose end is not after their start;
- overlapping ranges for the same weekday;
- malformed day or time values.

Changes affect future open availability only. They never cancel, move, or delete an existing appointment. If a changed range conflicts with an existing appointment, the appointment remains in the calendar and the therapist receives an explicit warning that it must be handled separately.

## Availability Exceptions

The therapist can add an absence exception for a concrete date and time range, with an optional short reason. Exceptions override the recurring template when available patient slots are calculated.

An exception must have a valid date and an end after its start. Overlapping exceptions for the same date are rejected with a validation message. An exception never automatically cancels an existing appointment. Conflicts produce a warning and retain the appointment.

## Data Model

Keep the existing `appointments` table and appointment service types/statuses. Add:

### `specialists`

- `id`: text primary key compatible with existing `appointments.specialist_id` values;
- display identity required by the public therapist shell;
- one deterministic row for the demo specialist.

### `weekly_availability`

- specialist identifier;
- ISO weekday;
- local start time;
- local end time;
- service type restricted to `niskoplatna` or `bezplatna`;
- timestamps needed for deterministic updates.

### `availability_exceptions`

- specialist identifier;
- local calendar date;
- local start time;
- local end time;
- optional reason;
- timestamps needed for deterministic updates.

All exposed-schema tables have RLS enabled. No `anon` or `authenticated` policies are added for this public mockup because browser code must not query these tables directly. Server Components and Server Actions access data through the existing server-only Supabase client.

Database constraints cover row-level invariants such as allowed service types and valid time ranges. The aggregate 300-minute weekly rule and cross-row overlap checks are enforced in the server-side availability write operation within a transaction-safe database operation so concurrent writes cannot bypass validation.

## Data Flow

1. The `/panel` Server Component reads the fixed demo specialist, visible appointments, recurring availability, and relevant exceptions.
2. Cancelled appointments are excluded by the server query rather than merely hidden with CSS.
3. A focused client calendar component manages week/month presentation, navigation, selected appointment, and modal state.
4. Availability changes are submitted to a Server Action, validated atomically, persisted, and followed by route revalidation.
5. Absence exceptions follow the same server-only mutation path.
6. The existing patient slot search incorporates the recurring template and exceptions when producing bookable slots, without otherwise changing the patient UI.

All calendar calculations use the `Europe/Warsaw` business timezone and persist appointment instants as `timestamptz`. Weekly template times and exception dates/times represent Warsaw local wall time; conversion must account for daylight-saving transitions.

## Example Data

Seed one therapist plus a small deterministic set of appointments across the current demo period:

- confirmed future appointments;
- held/pending future appointments where appropriate;
- completed historical appointments;
- a no-show historical appointment;
- at least one cancelled appointment to prove it is excluded;
- multiple service types and multiple appointments for one patient to demonstrate history.

Seeding must be idempotent and must not duplicate rows on repeated migration or setup runs.

## Error Handling

- Supabase read failures render a clear panel-level error state with a retry path, not an empty calendar.
- Invalid availability submissions return Polish field-level or form-level feedback while preserving the user's edits.
- Failed mutations do not optimistically claim success.
- Appointment/absence conflicts are warnings and do not silently mutate appointments.
- Unknown appointment IDs do not expose unrelated records.

## Component Boundaries

- Server-only therapist data access: queries and mutations scoped to the fixed specialist.
- Calendar shell: mode, period navigation, and responsive layout.
- Week view: hour grid, appointments, and absence blocks.
- Month view: day summaries and week selection.
- Appointment details: permitted contact and visit-history information only.
- Availability editor: recurring ranges, category selection, duration counter, and validation feedback.
- Exception form: date-specific absence creation and conflict warning.

Each unit should expose typed inputs and remain independently testable. Shared appointment rules stay in the existing data layer; therapist-specific calendar logic must not be added to patient UI components.

## Verification

Automated coverage must verify:

- eligible weekly duration is combined across 55 PLN and free ranges;
- a schedule below 300 minutes is rejected server-side;
- invalid and overlapping ranges are rejected;
- an availability edit retains existing appointments;
- absence exceptions remove matching patient-facing free slots;
- cancelled appointments are excluded from therapist queries;
- the fixed therapist cannot retrieve another specialist's appointments;
- appointment details contain only the approved patient fields;
- week/month calendar transformations work at month and DST boundaries.

Run the focused tests, the repository lint command, and a production build. Where a configured Supabase test project is available, verify migrations and critical queries against it; otherwise run database-independent unit coverage and clearly report the missing integration verification.

## Explicit Non-Goals

- Supabase Auth or therapist login;
- multiple selectable therapist accounts;
- a standalone/full patient profile;
- clinical or therapeutic notes;
- automatic cancellation or rescheduling caused by availability edits;
- changes to patient-facing visual design;
- coordinator features, settlements, messaging, invoices, or reporting;
- realtime calendar subscriptions.

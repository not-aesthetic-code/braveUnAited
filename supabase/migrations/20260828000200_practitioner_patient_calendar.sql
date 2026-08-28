-- Normalizes the booking slice: specialists become practitioners (real FK
-- already existed), patient contact info gets real identity (dedup by
-- phone — the only identifier guest booking guarantees), service catalog
-- moves out of app-code constants into the DB, and each practitioner gets a
-- calendar with recurring weekly hours + date-specific exceptions instead of
-- one hardcoded 9-17-every-day window for everyone.
--
-- Same posture as the existing tables throughout: RLS enabled, no grants to
-- anon/authenticated, reachable only via the service_role key server-side.

-- 1. practitioners (rename — keep the text id, it's already live in
-- Supabase Auth app_metadata.specialist_id on created doctor accounts and in
-- scripts/seed-doctors.ts; renaming the DB is safe, renaming that key is not)
alter table specialists rename to practitioners;
alter table appointments rename column specialist_id to practitioner_id;
alter table appointments rename constraint appointments_specialist_id_fkey to appointments_practitioner_id_fkey;

-- 2. patients — dedup key is phone (the only identifier guest booking
-- collects reliably); app code must not blindly overwrite a set email on
-- conflict, since /konto looks bookings up by email.
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text not null unique,
  created_at timestamptz not null default now()
);
alter table patients enable row level security;

-- If the same phone booked under two different emails historically, this
-- keeps the most recent non-empty one (not just the most recent row) so a
-- booking's email doesn't silently get discarded in favor of a blank one.
-- It still only keeps ONE email per phone — see the migration runbook note
-- in PROGRESS.md before pushing this against real (non-seed) data.
insert into patients (name, email, phone)
select distinct on (patient_phone) patient_name, nullif(patient_email, ''), patient_phone
from appointments
order by patient_phone, (nullif(patient_email, '') is null), created_at desc
on conflict (phone) do nothing;

alter table appointments add column patient_id uuid references patients(id);
update appointments a set patient_id = p.id from patients p where p.phone = a.patient_phone;
alter table appointments alter column patient_id set not null;
alter table appointments drop column patient_name;
alter table appointments drop column patient_email;
alter table appointments drop column patient_phone;

-- 3. services — replaces the ServiceType union + PRICE_BY_SERVICE /
-- SERVICE_LABELS constants in src/lib/appointments.ts. base_price null means
-- variable/per-practitioner (pelnoplatna).
create table if not exists services (
  id text primary key,
  title text not null,
  description text not null,
  duration_minutes integer not null,
  buffer_minutes integer not null default 10,
  base_price integer
);
alter table services enable row level security;

insert into services (id, title, description, duration_minutes, buffer_minutes, base_price) values
  ('niskoplatna', 'Konsultacja niskopłatna', 'Do 10 wizyt na pacjenta', 50, 10, 55),
  ('pelnoplatna', 'Konsultacja pełnopłatna', 'Stawka zależna od specjalisty', 50, 10, null),
  ('adhd_diagnoza', 'Diagnoza ADHD', '90 minut', 90, 10, 350),
  ('asystent_zdrowienia', 'Asystent zdrowienia', 'Wsparcie między sesjami', 50, 10, 37),
  ('bezplatna', 'Bezpłatna konsultacja', 'Pierwszy kontakt, bez opłat', 50, 10, 0);

-- 4. practitioner_services — replaces practitioners.services array +
-- pelnoplatna_rate column; price_override is only meaningful when the
-- service's base_price is null.
create table if not exists practitioner_services (
  practitioner_id text not null references practitioners(id),
  service_id text not null references services(id),
  price_override integer,
  primary key (practitioner_id, service_id)
);
alter table practitioner_services enable row level security;

insert into practitioner_services (practitioner_id, service_id, price_override)
select pr.id, s.service_id, case when s.service_id = 'pelnoplatna' then pr.pelnoplatna_rate else null end
from practitioners pr, unnest(pr.services) as s(service_id);

alter table practitioners drop column services;
alter table practitioners drop column pelnoplatna_rate;

-- appointments.service_type -> service_id (same text values as services.id,
-- so this is a rename + FK, not a data migration)
alter table appointments rename column service_type to service_id;
alter table appointments drop constraint if exists appointments_service_type_check;
alter table appointments add constraint appointments_service_id_fkey foreign key (service_id) references services(id);

-- 5. calendars — one per practitioner today; modeled separately so it's
-- relaxable later (e.g. multiple locations) without touching practitioners.
create table if not exists calendars (
  id uuid primary key default gen_random_uuid(),
  practitioner_id text not null unique references practitioners(id),
  timezone text not null default 'Europe/Warsaw',
  created_at timestamptz not null default now()
);
alter table calendars enable row level security;

insert into calendars (practitioner_id)
select id from practitioners;

-- 6. calendar_availability — recurring weekly hours, replaces the hardcoded
-- WORK_START_HOUR/WORK_END_HOUR (9-17, every day) in listAvailableSlots.
-- service_id null = applies to every service the practitioner offers;
-- non-null scopes the window to just that service (e.g. niskoplatna only
-- Mon/Wed mornings while pelnoplatna runs the full week).
create table if not exists calendar_availability (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id) on delete cascade,
  service_id text references services(id),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);
alter table calendar_availability enable row level security;

-- Seed matches current live behavior (9-17, every day of the week, every
-- service) — a real per-practitioner schedule is a follow-up, not part of
-- this migration.
insert into calendar_availability (calendar_id, day_of_week, start_time, end_time)
select c.id, d, '09:00', '17:00'
from calendars c, generate_series(0, 6) as d;

-- 7. calendar_exceptions — date-specific overrides on top of the recurring
-- rules above. kind='closed' removes availability that would otherwise
-- exist that day (e.g. a specific blocked slot, or a full day off when
-- start_time/end_time are both null); kind='open' adds availability outside
-- the recurring hours (e.g. one extra evening slot). service_id null =
-- applies to every service, matching calendar_availability's convention.
create table if not exists calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id) on delete cascade,
  service_id text references services(id),
  date date not null,
  kind text not null check (kind in ('closed', 'open')),
  start_time time,
  end_time time,
  check ((start_time is null) = (end_time is null)),
  check (start_time is null or start_time < end_time),
  check (kind = 'closed' or start_time is not null)
);
alter table calendar_exceptions enable row level security;

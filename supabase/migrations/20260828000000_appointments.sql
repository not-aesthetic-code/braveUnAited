-- Real store for the booking slice, replacing the in-memory Map in
-- src/lib/appointments.ts. Never exposed to the Data API: no grants to
-- anon/authenticated are issued, and RLS is enabled with no policies so only
-- the service_role key (used server-side only) can reach it.

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  specialist_id text not null,
  service_type text not null check (service_type in ('niskoplatna', 'pelnoplatna', 'adhd_diagnoza', 'asystent_zdrowienia', 'bezplatna')),
  starts_at timestamptz not null,
  status text not null default 'held' check (status in ('held', 'confirmed', 'cancelled', 'completed', 'no_show')),
  held_until timestamptz,
  patient_name text not null,
  patient_email text not null default '',
  patient_phone text not null,
  price integer not null,
  reschedule_count integer not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refund_due', 'refunded')),
  created_at timestamptz not null default now()
);

-- Guards the exact race the DB migration introduces: two concurrent
-- holdSlot calls for the same specialist+time. A stale (expired) held row is
-- cleaned up in application code before insert, so it never blocks a new hold.
create unique index if not exists appointments_specialist_slot_active
  on appointments (specialist_id, starts_at)
  where status in ('held', 'confirmed');

alter table appointments enable row level security;

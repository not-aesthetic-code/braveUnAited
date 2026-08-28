-- Therapist demo panel additions on top of the normalized practitioner model.

alter table calendar_exceptions add column if not exists reason text;

-- The public demo practitioner can allocate the required community hours
-- between the 55 PLN and free services.
insert into practitioner_services (practitioner_id, service_id, price_override)
values ('spec-1', 'bezplatna', null)
on conflict (practitioner_id, service_id) do nothing;

-- Replace spec-1's generic all-service seed with a realistic template:
-- paid consultations remain broadly available, while community hours total 5h.
delete from calendar_availability
where calendar_id = (select id from calendars where practitioner_id = 'spec-1');

insert into calendar_availability (calendar_id, service_id, day_of_week, start_time, end_time)
select c.id, v.service_id, v.day_of_week, v.start_time::time, v.end_time::time
from calendars c
cross join (values
  ('niskoplatna', 1, '09:00', '11:00'),
  ('bezplatna', 3, '09:00', '12:00'),
  ('pelnoplatna', 1, '12:00', '17:00'),
  ('pelnoplatna', 2, '09:00', '17:00'),
  ('pelnoplatna', 3, '12:00', '17:00'),
  ('pelnoplatna', 4, '09:00', '17:00'),
  ('pelnoplatna', 5, '09:00', '15:00')
) as v(service_id, day_of_week, start_time, end_time)
where c.practitioner_id = 'spec-1';

-- Atomic replacement protects the aggregate five-hour rule from concurrent
-- browser submissions. The function is callable only by service_role.
create or replace function replace_community_availability(
  p_practitioner_id text,
  p_ranges jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_calendar_id uuid;
  v_minutes integer;
begin
  select id into v_calendar_id from calendars where practitioner_id = p_practitioner_id;
  if v_calendar_id is null then
    raise exception 'Nie znaleziono kalendarza terapeuty.';
  end if;

  if jsonb_typeof(p_ranges) <> 'array' or jsonb_array_length(p_ranges) = 0 then
    raise exception 'Ustaw co najmniej 5 godzin tygodniowo.';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_ranges)
      as r(day_of_week integer, start_time time, end_time time, service_id text)
    where r.day_of_week not between 0 and 6
       or r.start_time is null or r.end_time is null or r.start_time >= r.end_time
       or r.service_id not in ('niskoplatna', 'bezplatna')
  ) then
    raise exception 'Niepoprawny zakres dostępności.';
  end if;

  if exists (
    with ranges as (
      select row_number() over () as id, r.*
      from jsonb_to_recordset(p_ranges)
        as r(day_of_week integer, start_time time, end_time time, service_id text)
    )
    select 1 from ranges a join ranges b
      on a.id < b.id and a.day_of_week = b.day_of_week
     and a.start_time < b.end_time and b.start_time < a.end_time
  ) then
    raise exception 'Godziny w tym samym dniu nie mogą na siebie nachodzić.';
  end if;

  select coalesce(sum(extract(epoch from (r.end_time - r.start_time)) / 60), 0)::integer
  into v_minutes
  from jsonb_to_recordset(p_ranges)
    as r(day_of_week integer, start_time time, end_time time, service_id text);

  if v_minutes < 300 then
    raise exception 'Ustaw co najmniej 5 godzin tygodniowo dla wizyt 55 zł lub Darmowych.';
  end if;

  delete from calendar_availability
  where calendar_id = v_calendar_id and service_id in ('niskoplatna', 'bezplatna');

  insert into calendar_availability (calendar_id, service_id, day_of_week, start_time, end_time)
  select v_calendar_id, r.service_id, r.day_of_week, r.start_time, r.end_time
  from jsonb_to_recordset(p_ranges)
    as r(day_of_week integer, start_time time, end_time time, service_id text);
end;
$$;

revoke all on function replace_community_availability(text, jsonb) from public, anon, authenticated;
grant execute on function replace_community_availability(text, jsonb) to service_role;

-- Stable demo patients and appointments. IDs make this rerunnable.
insert into patients (id, name, email, phone) values
  ('10000000-0000-4000-8000-000000000001', 'Katarzyna Malinowska', 'kasia.m@example.com', '601234567'),
  ('10000000-0000-4000-8000-000000000002', 'Tomasz Krawczyk', 'tomasz.k@example.com', '602345678'),
  ('10000000-0000-4000-8000-000000000003', 'Joanna Wróbel', 'joanna.w@example.com', '603456789')
on conflict (id) do nothing;

insert into appointments (
  id, practitioner_id, service_id, starts_at, status, held_until,
  patient_id, price, reschedule_count, payment_status
) values
  ('20000000-0000-4000-8000-000000000001', 'spec-1', 'pelnoplatna', '2026-08-31 15:00:00+02', 'confirmed', null, '10000000-0000-4000-8000-000000000001', 125, 0, 'paid'),
  ('20000000-0000-4000-8000-000000000002', 'spec-1', 'niskoplatna', '2026-09-01 09:00:00+02', 'confirmed', null, '10000000-0000-4000-8000-000000000002', 55, 0, 'paid'),
  ('20000000-0000-4000-8000-000000000003', 'spec-1', 'bezplatna', '2026-09-02 09:00:00+02', 'confirmed', null, '10000000-0000-4000-8000-000000000003', 0, 0, 'paid'),
  ('20000000-0000-4000-8000-000000000004', 'spec-1', 'pelnoplatna', '2026-08-20 12:00:00+02', 'completed', null, '10000000-0000-4000-8000-000000000001', 125, 0, 'paid'),
  ('20000000-0000-4000-8000-000000000005', 'spec-1', 'niskoplatna', '2026-08-18 10:00:00+02', 'no_show', null, '10000000-0000-4000-8000-000000000002', 55, 0, 'paid'),
  ('20000000-0000-4000-8000-000000000006', 'spec-1', 'pelnoplatna', '2026-09-03 14:00:00+02', 'cancelled', null, '10000000-0000-4000-8000-000000000001', 125, 0, 'refund_due')
on conflict (id) do nothing;

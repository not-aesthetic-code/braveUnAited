-- Single-hour corrections on top of the weekly rhythm, as in the mockup's
-- "Poprawki na konkretnych godzinach" grid. They reuse calendar_exceptions
-- (kind='open' adds an hour, kind='closed' removes one) so the patient slot
-- generator picks them up with no changes; `source` only separates them from
-- multi-hour absences so the two UIs don't list each other's rows.
alter table calendar_exceptions
  add column if not exists source text not null default 'absence'
  check (source in ('absence', 'correction'));

-- One correction per calendar/service/date/hour keeps toggling idempotent:
-- clicking the same cell twice can never stack two contradictory rows.
create unique index if not exists calendar_exceptions_correction_slot
  on calendar_exceptions (calendar_id, date, start_time, coalesce(service_id, ''))
  where source = 'correction';

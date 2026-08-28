-- The original calendar_availability seed (20260828000200) used
-- service_id = null to mean "every service" — correct for the booking-side
-- read path (slotStartsForDay treats null as a wildcard), but incompatible
-- with the new /panel/dostepnosc screen, which edits one service
-- (pelnoplatna or niskoplatna) at a time via a per-(calendar_id, service_id)
-- replace-all. A null-scoped row can never be targeted by that write, so it
-- would keep unioning with whatever the practitioner sets, making edits look
-- like they don't take effect.
--
-- Expand each null-scoped row into one explicit row per service. This is a
-- no-op for booking behavior: slotStartsForDay's `forThisService` already
-- matched all 5 services for a null row, so 5 explicit rows produce the
-- identical result. adhd_diagnoza/asystent_zdrowienia/bezplatna keep their
-- current 9-17-every-day hours untouched — no screen manages them yet.
insert into calendar_availability (calendar_id, service_id, day_of_week, start_time, end_time)
select ca.calendar_id, s.id, ca.day_of_week, ca.start_time, ca.end_time
from calendar_availability ca
cross join services s
where ca.service_id is null;

delete from calendar_availability where service_id is null;

-- Patient-side cancellation reason (optional, shown to the practitioner and
-- rolled into aggregate foundation stats — never a free-text field, since
-- that would need moderation) and a practitioner contact email so the
-- "write to specialist" path (used when the 24h free-cancellation window has
-- passed) has somewhere to point. Same posture as the rest of the booking
-- slice: RLS on, service_role only.

alter table appointments add column cancel_reason text
  check (cancel_reason is null or cancel_reason in ('choroba', 'kolizja_obowiazkow', 'nie_potrzebuje_juz'));

-- practitioners.email becomes the source of truth for the doctor's login
-- email — scripts/seed-doctors.ts is updated to read it instead of deriving
-- it from the name, so there's exactly one place this is computed.
alter table practitioners add column email text;

update practitioners set email = 'anna.kowalska@example.com' where id = 'spec-1';
update practitioners set email = 'marek.nowak@example.com' where id = 'spec-2';
update practitioners set email = 'ola.wisniewska@example.com' where id = 'spec-3';

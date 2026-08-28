-- Which services a practitioner has enabled — distinct from
-- calendar_availability, which is *when* an enabled service is bookable. A
-- practitioner can pause a service (is_accepting = false) without losing its
-- configured hours or its foundation grant (the practitioner_services row
-- itself). location_mode is a service-level attribute set by the
-- foundation, same posture as duration_minutes/base_price already on this
-- table.
--
-- Both columns are additive with safe defaults, so existing rows keep their
-- current behavior: every practitioner_services row already represents a
-- foundation-granted service (see 20260828000200), so defaulting
-- is_accepting to true preserves today's booking eligibility exactly.
alter table services add column if not exists location_mode text not null default 'online'
  check (location_mode in ('online', 'stacjonarnie'));

alter table practitioner_services add column if not exists is_accepting boolean not null default true;

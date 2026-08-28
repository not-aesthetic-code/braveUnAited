-- Specialists as real rows instead of a hardcoded array in application code,
-- so appointments can FK against them and a logged-in doctor's own record
-- can be looked up by id. Same posture as appointments: RLS on, no grants to
-- anon/authenticated, reachable only via the service_role key server-side.

create table if not exists specialists (
  id text primary key,
  name text not null,
  services text[] not null,
  pelnoplatna_rate integer
);

insert into specialists (id, name, services, pelnoplatna_rate) values
  ('spec-1', 'Anna Kowalska', array['niskoplatna', 'pelnoplatna'], 125),
  ('spec-2', 'Marek Nowak', array['pelnoplatna', 'adhd_diagnoza'], 145),
  ('spec-3', 'Ola Wiśniewska', array['asystent_zdrowienia', 'bezplatna'], null)
on conflict (id) do nothing;

alter table specialists enable row level security;

alter table appointments
  add constraint appointments_specialist_id_fkey
  foreign key (specialist_id) references specialists(id);

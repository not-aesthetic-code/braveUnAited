-- Tracks when a 6-week-no-visit reminder (getPatientsToRemind in
-- appointments.ts) was last emailed to a patient. Without this, /panel would
-- have no way to show a specialist whether a reminder already went out —
-- every reload would look like nobody had ever been contacted.
alter table patients add column if not exists last_reminder_sent_at timestamptz;

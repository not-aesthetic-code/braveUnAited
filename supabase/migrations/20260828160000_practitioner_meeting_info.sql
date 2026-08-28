-- Meeting info (video link or address) per practitioner, shown on the
-- patient confirmation screen right after payment — plan.md's demo script
-- step 2 ("confirmation screen showing the video link/address immediately")
-- wasn't implemented anywhere yet. One freeform field rather than separate
-- video_link/address columns: this slice's practitioners each run one fixed
-- format, not a per-appointment choice, so the UI just renders whichever
-- string is set (as a link if it looks like a URL, plain text otherwise).

alter table practitioners add column if not exists meeting_info text;

update practitioners set meeting_info = 'https://meet.google.com/anna-kowal-ska' where id = 'spec-1';
update practitioners set meeting_info = 'https://meet.google.com/marek-nowa-kpl' where id = 'spec-2';
update practitioners set meeting_info = 'ul. Krucza 24/3, 00-526 Warszawa' where id = 'spec-3';

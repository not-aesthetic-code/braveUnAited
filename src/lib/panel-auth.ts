import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Cached per-request (React's cache(), not cross-request) so the layout and
// the page it wraps both call this without double-hitting Supabase — see
// the "Fetching Data" caveat in Next's layout docs: layouts can't pass data
// to children, so each segment re-derives it, deduped via cache().
export const getPractitionerSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // The auth metadata key stays `specialist_id` even after the DB rename to
  // `practitioners` — it's already provisioned on live Supabase Auth users
  // (scripts/seed-doctors.ts), and renaming it would log every doctor out
  // until the seed script reran.
  const practitionerId = claims?.app_metadata?.specialist_id as string | undefined;
  return { claims, practitionerId };
});

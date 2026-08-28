// One-off: creates/updates a Supabase Auth user per row in `practitioners`,
// so each doctor can log in to /panel and see only their own visits (matched
// via app_metadata.specialist_id, which RLS/app code trusts because it's
// only settable through the service_role key, never by the user). That
// metadata key stays `specialist_id` even after the `specialists` table was
// renamed to `practitioners` — it's already live on created accounts, and
// renaming it would log every doctor out until this script reran.
//
// Run with: pnpm seed:doctors
import { createClient } from "@supabase/supabase-js";

const DEMO_PASSWORD = process.env.DOCTOR_SEED_PASSWORD ?? "specjalista123";

function emailFor(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (ą, ł, ś, …) after NFD decomposition
    .toLowerCase()
    .replace(/[^a-z]+/g, ".");
  return `${slug}@example.com`;
}

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: practitioners, error } = await db.from("practitioners").select("id, name, email");
  if (error) throw error;

  const { data: existing, error: listError } = await db.auth.admin.listUsers();
  if (listError) throw listError;

  const credentials: { name: string; email: string; password: string }[] = [];

  for (const spec of practitioners ?? []) {
    // practitioners.email is the source of truth once seeded (migration
    // 20260828170000); fall back to the derived slug for a practitioner
    // added before that column was backfilled.
    const email = spec.email ?? emailFor(spec.name);
    const user = existing.users.find((u) => u.email === email);

    if (user) {
      const { error: updateError } = await db.auth.admin.updateUserById(user.id, {
        password: DEMO_PASSWORD,
        app_metadata: { specialist_id: spec.id },
      });
      if (updateError) throw updateError;
    } else {
      const { error: createError } = await db.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        app_metadata: { specialist_id: spec.id },
      });
      if (createError) throw createError;
    }

    credentials.push({ name: spec.name, email, password: DEMO_PASSWORD });
  }

  console.table(credentials);
}

main();

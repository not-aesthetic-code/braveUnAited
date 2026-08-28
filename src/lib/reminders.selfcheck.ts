// Run with: pnpm dlx dotenv -e .env.local -- pnpm dlx tsx src/lib/reminders.selfcheck.ts
// Hits the real Supabase tables — needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// in the environment. Every appointment this script creates is tagged with
// contact.email and deleted in the finally block, same cleanup pattern as
// appointments.selfcheck.ts.
import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import {
  holdSlot,
  confirmPayment,
  getPatientsToRemind,
  REMINDER_AFTER_WEEKS,
} from "./appointments";

const contact = { name: "Reminder Test", email: "reminders-selfcheck@example.com", phone: "500900901" };
const CUTOFF_DAYS = REMINDER_AFTER_WEEKS * 7;

async function main() {
  const now = new Date("2026-09-15T10:00:00Z");

  // Past visit older than the cutoff, no upcoming booking -> flagged.
  {
    const held = await holdSlot(
      {
        practitionerId: "spec-1",
        serviceType: "niskoplatna",
        startsAt: new Date(now.getTime() - (CUTOFF_DAYS + 7) * 86_400_000).toISOString(),
        patientContact: contact,
      },
      new Date(now.getTime() - (CUTOFF_DAYS + 8) * 86_400_000)
    );
    await confirmPayment(held.id, new Date(now.getTime() - (CUTOFF_DAYS + 8) * 86_400_000));

    const reminders = await getPatientsToRemind("spec-1", now);
    assert.ok(
      reminders.some((r) => r.patient.phone === contact.phone),
      "patient with a stale confirmed visit and nothing upcoming must be flagged"
    );
  }

  // Same patient books something upcoming -> no longer flagged.
  {
    const upcomingHeld = await holdSlot(
      {
        practitionerId: "spec-1",
        serviceType: "niskoplatna",
        startsAt: new Date(now.getTime() + 3 * 86_400_000).toISOString(),
        patientContact: contact,
      },
      now
    );
    await confirmPayment(upcomingHeld.id, now);

    const reminders = await getPatientsToRemind("spec-1", now);
    assert.ok(
      !reminders.some((r) => r.patient.phone === contact.phone),
      "a patient with an upcoming confirmed booking must not be flagged"
    );
  }

  console.log("reminders (getPatientsToRemind) self-check passed");
}

main().finally(async () => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: patient } = await db.from("patients").select("id").eq("phone", contact.phone).maybeSingle();
  if (patient) {
    await db.from("appointments").delete().eq("patient_id", patient.id);
    await db.from("patients").delete().eq("id", patient.id);
  }
});

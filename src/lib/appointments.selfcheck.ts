// Run with: pnpm dlx dotenv -e .env.local -- pnpm dlx tsx src/lib/appointments.selfcheck.ts
// Hits the real Supabase table (see supabase/migrations/) — needs SUPABASE_URL
// / SUPABASE_SERVICE_ROLE_KEY in the environment. Rows this leaves behind are
// tagged with contact.email below and deleted in the finally block, so the
// table stays clean and the script stays rerunnable (the unique index on
// (specialist_id, starts_at) would otherwise reject the second run's inserts
// once the first run's rows are "confirmed").
import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import {
  holdSlot,
  confirmPayment,
  cancelAppointment,
  rescheduleAppointment,
  canManage,
  listAvailableSlots,
  HOLD_MINUTES,
  MAX_RESCHEDULES,
} from "./appointments";

const contact = { name: "Test", email: "selfcheck@example.com", phone: "123" };

async function main() {
  // Hold expires after HOLD_MINUTES.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const appt = await holdSlot(
      { specialistId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-10T10:00:00Z", patientContact: contact },
      now
    );
    const justBefore = new Date(now.getTime() + HOLD_MINUTES * 60_000 - 1000);
    const justAfter = new Date(now.getTime() + HOLD_MINUTES * 60_000 + 1000);
    assert.equal((await confirmPayment(appt.id, justBefore)).status, "confirmed");
    const expired = await holdSlot(
      { specialistId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-11T10:00:00Z", patientContact: contact },
      now
    );
    await assert.rejects(() => confirmPayment(expired.id, justAfter));
  }

  // Cancel >24h gives refund_due; <24h is rejected.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const farHeld = await holdSlot({ specialistId: "spec-1", serviceType: "pelnoplatna", startsAt: "2026-09-10T11:00:00Z", patientContact: contact }, now);
    const farAppt = await confirmPayment(farHeld.id, now);
    const cancelled = await cancelAppointment(farAppt.id, now);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.paymentStatus, "refund_due");

    const soonHeld = await holdSlot({ specialistId: "spec-1", serviceType: "pelnoplatna", startsAt: "2026-09-01T20:00:00Z", patientContact: contact }, now);
    const soonAppt = await confirmPayment(soonHeld.id, now);
    assert.equal(canManage(soonAppt, now).canCancel, false);
    await assert.rejects(() => cancelAppointment(soonAppt.id, now));
  }

  // Reschedule stops at MAX_RESCHEDULES.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const held = await holdSlot({ specialistId: "spec-2", serviceType: "adhd_diagnoza", startsAt: "2026-09-10T12:00:00Z", patientContact: contact }, now);
    let appt = await confirmPayment(held.id, now);
    for (let i = 0; i < MAX_RESCHEDULES; i++) {
      appt = await rescheduleAppointment(appt.id, "2026-09-15T10:00:00Z", now);
    }
    assert.equal(appt.rescheduleCount, MAX_RESCHEDULES);
    await assert.rejects(() => rescheduleAppointment(appt.id, "2026-09-20T10:00:00Z", now));
  }

  // A specialist's slot is one calendar across service types: booking a longer
  // session (ADHD, 90min) blocks overlapping slots of a different service
  // (pelnoplatna, 50min) offered by the same specialist, not just the exact
  // same start time.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const held = await holdSlot({ specialistId: "spec-2", serviceType: "adhd_diagnoza", startsAt: "2026-09-10T09:00:00Z", patientContact: contact }, now);
    await confirmPayment(held.id, now);
    const pelnoSlots = (await listAvailableSlots("pelnoplatna", now)).filter(
      (s) => s.specialistId === "spec-2" && s.startsAt.startsWith("2026-09-10")
    );
    assert.ok(
      pelnoSlots.every((s) => new Date(s.startsAt).getTime() >= new Date("2026-09-10T10:30:00Z").getTime()),
      "pelnoplatna slot overlaps a booked adhd_diagnoza session"
    );
  }

  console.log("appointments.ts self-check passed");
}

main().finally(async () => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  await db.from("appointments").delete().eq("patient_email", contact.email);
});

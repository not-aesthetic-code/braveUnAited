// Run with: pnpm dlx tsx src/lib/appointments.selfcheck.ts
import assert from "node:assert";
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

const contact = { name: "Test", email: "t@example.com", phone: "123" };

// Hold expires after HOLD_MINUTES.
{
  const now = new Date("2026-09-01T10:00:00Z");
  const appt = holdSlot(
    { specialistId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-10T10:00:00Z", patientContact: contact },
    now
  );
  const justBefore = new Date(now.getTime() + HOLD_MINUTES * 60_000 - 1000);
  const justAfter = new Date(now.getTime() + HOLD_MINUTES * 60_000 + 1000);
  assert.equal(confirmPayment(appt.id, justBefore).status, "confirmed");
  const expired = holdSlot(
    { specialistId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-11T10:00:00Z", patientContact: contact },
    now
  );
  assert.throws(() => confirmPayment(expired.id, justAfter));
}

// Cancel >24h gives refund_due; <24h is rejected.
{
  const now = new Date("2026-09-01T10:00:00Z");
  const farAppt = confirmPayment(
    holdSlot({ specialistId: "spec-1", serviceType: "pelnoplatna", startsAt: "2026-09-10T10:00:00Z", patientContact: contact }, now).id,
    now
  );
  const cancelled = cancelAppointment(farAppt.id, now);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.paymentStatus, "refund_due");

  const soonAppt = confirmPayment(
    holdSlot({ specialistId: "spec-1", serviceType: "pelnoplatna", startsAt: "2026-09-01T20:00:00Z", patientContact: contact }, now).id,
    now
  );
  assert.equal(canManage(soonAppt, now).canCancel, false);
  assert.throws(() => cancelAppointment(soonAppt.id, now));
}

// Reschedule stops at MAX_RESCHEDULES.
{
  const now = new Date("2026-09-01T10:00:00Z");
  let appt = confirmPayment(
    holdSlot({ specialistId: "spec-2", serviceType: "adhd_diagnoza", startsAt: "2026-09-10T10:00:00Z", patientContact: contact }, now).id,
    now
  );
  for (let i = 0; i < MAX_RESCHEDULES; i++) {
    appt = rescheduleAppointment(appt.id, "2026-09-15T10:00:00Z", now);
  }
  assert.equal(appt.rescheduleCount, MAX_RESCHEDULES);
  assert.throws(() => rescheduleAppointment(appt.id, "2026-09-20T10:00:00Z", now));
}

// A specialist's slot is one calendar across service types: booking a longer
// session (ADHD, 90min) blocks overlapping slots of a different service
// (pelnoplatna, 50min) offered by the same specialist, not just the exact
// same start time.
{
  const now = new Date("2026-09-01T10:00:00Z");
  confirmPayment(
    holdSlot({ specialistId: "spec-2", serviceType: "adhd_diagnoza", startsAt: "2026-09-10T09:00:00Z", patientContact: contact }, now).id,
    now
  );
  const pelnoSlots = listAvailableSlots("pelnoplatna", now).filter(
    (s) => s.specialistId === "spec-2" && s.startsAt.startsWith("2026-09-10")
  );
  assert.ok(
    pelnoSlots.every((s) => new Date(s.startsAt).getTime() >= new Date("2026-09-10T10:30:00Z").getTime()),
    "pelnoplatna slot overlaps a booked adhd_diagnoza session"
  );
}

console.log("appointments.ts self-check passed");

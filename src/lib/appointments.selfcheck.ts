// Run with: pnpm dlx dotenv -e .env.local -- pnpm dlx tsx src/lib/appointments.selfcheck.ts
// Hits the real Supabase table (see supabase/migrations/) — needs SUPABASE_URL
// / SUPABASE_SERVICE_ROLE_KEY in the environment. Rows this leaves behind are
// tagged with contact.phone below and deleted in the finally block, so the
// table stays clean and the script stays rerunnable (the unique index on
// (practitioner_id, starts_at) would otherwise reject the second run's inserts
// once the first run's rows are "confirmed").
import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import {
  holdSlot,
  confirmPayment,
  cancelAppointment,
  rescheduleAppointment,
  cancelAppointmentAsPractitioner,
  rescheduleAppointmentAsPractitioner,
  markNoShow,
  canManage,
  cancelDeadline,
  listAvailableSlots,
  getAppointment,
  getPatientsToRemind,
  sendVisitReminderEmail,
  HOLD_MINUTES,
  MAX_RESCHEDULES,
  ATTENDANCE_GRACE_HOURS,
} from "./appointments";

// A bare national number — the +48 country code is hardcoded (see phone.ts),
// so upsertPatientByPhone stores this as "+48690000001". The finally block
// below has to look appointments up by that stored form, not this raw input.
// A placeholder like the old "123" would now be rejected outright.
const contact = { name: "Test", email: "selfcheck@example.com", phone: "690000001" };
const contactPhoneStored = "+48690000001";

// A guest who never gave an email — for the "can't email this patient"
// branch of sendVisitReminderEmail.
const noEmailContact = { name: "Test NoEmail", email: "", phone: "690000002" };
const noEmailPhoneStored = "+48690000002";

async function main() {
  // Hold expires after HOLD_MINUTES.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const appt = await holdSlot(
      { practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-10T10:00:00Z", patientContact: contact },
      now
    );
    const justBefore = new Date(now.getTime() + HOLD_MINUTES * 60_000 - 1000);
    const justAfter = new Date(now.getTime() + HOLD_MINUTES * 60_000 + 1000);
    assert.equal((await confirmPayment(appt.id, justBefore)).status, "confirmed");
    const expired = await holdSlot(
      { practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-11T10:00:00Z", patientContact: contact },
      now
    );
    await assert.rejects(() => confirmPayment(expired.id, justAfter));
  }

  // Cancel >24h gives refund_due (with an optional reason recorded and the
  // free-cancellation deadline computed 24h before the visit); <24h is
  // rejected.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const farHeld = await holdSlot({ practitionerId: "spec-1", serviceType: "pelnoplatna", startsAt: "2026-09-10T11:00:00Z", patientContact: contact }, now);
    const farAppt = await confirmPayment(farHeld.id, now);
    assert.equal(cancelDeadline(farAppt).toISOString(), "2026-09-09T11:00:00.000Z");
    const cancelled = await cancelAppointment(farAppt.id, "choroba", now);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.paymentStatus, "refund_due");
    assert.equal(cancelled.cancelReason, "choroba");

    const soonHeld = await holdSlot({ practitionerId: "spec-1", serviceType: "pelnoplatna", startsAt: "2026-09-01T20:00:00Z", patientContact: contact }, now);
    const soonAppt = await confirmPayment(soonHeld.id, now);
    assert.equal(canManage(soonAppt, now).canCancel, false);
    await assert.rejects(() => cancelAppointment(soonAppt.id, null, now));
  }

  // Practitioner marking a no-show: only allowed once the visit's start time
  // has passed. Plain no-show leaves payment as "paid" (counts toward the
  // specialist's settlement); the full-refund exception behaves exactly like
  // a patient cancellation (refund_due).
  {
    const bookedAt = new Date("2026-09-01T06:00:00Z");
    const startsAt = "2026-09-01T09:00:00Z";
    const afterVisit = new Date("2026-09-01T10:00:00Z");

    const missedHeld = await holdSlot({ practitionerId: "spec-1", serviceType: "niskoplatna", startsAt, patientContact: contact }, bookedAt);
    const missedAppt = await confirmPayment(missedHeld.id, bookedAt);
    await assert.rejects(() => markNoShow(missedAppt.id, "someone-elses-id", false, afterVisit));
    await assert.rejects(() => markNoShow(missedAppt.id, "spec-1", false, bookedAt)); // visit hasn't happened yet
    const noShow = await markNoShow(missedAppt.id, "spec-1", false, afterVisit);
    assert.equal(noShow.status, "no_show");
    assert.equal(noShow.paymentStatus, "paid");

    const exceptionHeld = await holdSlot({ practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-02T09:00:00Z", patientContact: contact }, bookedAt);
    const exceptionAppt = await confirmPayment(exceptionHeld.id, bookedAt);
    const exception = await markNoShow(exceptionAppt.id, "spec-1", true, new Date("2026-09-02T10:00:00Z"));
    assert.equal(exception.status, "cancelled");
    assert.equal(exception.paymentStatus, "refund_due");
  }

  // Reschedule stops at MAX_RESCHEDULES.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const held = await holdSlot({ practitionerId: "spec-2", serviceType: "adhd_diagnoza", startsAt: "2026-09-10T12:00:00Z", patientContact: contact }, now);
    let appt = await confirmPayment(held.id, now);
    for (let i = 0; i < MAX_RESCHEDULES; i++) {
      appt = await rescheduleAppointment(appt.id, "2026-09-15T10:00:00Z", now);
    }
    assert.equal(appt.rescheduleCount, MAX_RESCHEDULES);
    await assert.rejects(() => rescheduleAppointment(appt.id, "2026-09-20T10:00:00Z", now));
  }

  // A practitioner's slot is one calendar across service types: booking a
  // longer session (ADHD, 90min) blocks overlapping slots of a different
  // service (pelnoplatna, 50min) offered by the same practitioner, not just
  // the exact same start time.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const held = await holdSlot({ practitionerId: "spec-2", serviceType: "adhd_diagnoza", startsAt: "2026-09-10T09:00:00Z", patientContact: contact }, now);
    await confirmPayment(held.id, now);
    const pelnoSlots = (await listAvailableSlots("pelnoplatna", now)).filter(
      (s) => s.practitionerId === "spec-2" && s.startsAt.startsWith("2026-09-10")
    );
    assert.ok(
      pelnoSlots.every((s) => new Date(s.startsAt).getTime() >= new Date("2026-09-10T10:30:00Z").getTime()),
      "pelnoplatna slot overlaps a booked adhd_diagnoza session"
    );
  }

  // Unmarked confirmed visits default to "completed" ATTENDANCE_GRACE_HOURS
  // after they end, instead of reading "confirmed" forever.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const held = await holdSlot({ practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-12T10:00:00Z", patientContact: contact }, now);
    const appt = await confirmPayment(held.id, now);
    const endsAt = new Date(appt.startsAt).getTime() + appt.service.durationMinutes * 60_000;

    const stillInGrace = new Date(endsAt + ATTENDANCE_GRACE_HOURS * 3_600_000 - 1000);
    assert.equal((await getAppointment(appt.id, stillInGrace))?.status, "confirmed");

    const pastGrace = new Date(endsAt + ATTENDANCE_GRACE_HOURS * 3_600_000 + 1000);
    assert.equal((await getAppointment(appt.id, pastGrace))?.status, "completed");
  }

  // getPatientsToRemind must still surface a visit that already auto-completed
  // — filtering on status "confirmed" alone would silently lose it once
  // expireIfStale() settles it.
  {
    const holdNow = new Date("2025-12-31T00:00:00Z");
    const held = await holdSlot({ practitionerId: "spec-3", serviceType: "niskoplatna", startsAt: "2026-01-01T10:00:00Z", patientContact: contact }, holdNow);
    const appt = await confirmPayment(held.id, holdNow);

    const now = new Date("2026-09-01T10:00:00Z"); // months later — well past the grace window and the 6-week reminder cutoff
    assert.equal((await getAppointment(appt.id, now))?.status, "completed");

    const reminders = await getPatientsToRemind("spec-3", now);
    assert.ok(
      reminders.some((r) => r.patient.id === appt.patientId),
      "auto-completed visit should still surface for reminder outreach"
    );
  }

  // Phone normalization is wired into upsertPatientByPhone: different ways
  // of typing the same national number (see phone.selfcheck.ts for the
  // pure-function cases) resolve to the same patient row, and a number that
  // isn't 9 digits is rejected before it can reach the DB at all.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const a = await holdSlot(
      { practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-13T10:00:00Z", patientContact: { ...contact, phone: "690 000 001" } },
      now
    );
    const b = await holdSlot(
      { practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-13T11:30:00Z", patientContact: { ...contact, phone: "690-000-001" } },
      now
    );
    assert.equal(a.patientId, b.patientId, "different formats of the same number should dedupe to one patient");

    await assert.rejects(
      () =>
        holdSlot(
          { practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-13T13:00:00Z", patientContact: { ...contact, phone: "not-a-phone" } },
          now
        ),
      "an invalid phone number should be rejected"
    );
  }

  // Reminder email: applies to any service type (not just adhd_diagnoza —
  // that's a different, immediate booking-confirmation SMS), records when it
  // went out so getPatientsToRemind can report "already sent", and refuses a
  // patient with no email on file instead of silently doing nothing.
  {
    const holdNow = new Date("2025-06-01T00:00:00Z");
    const held = await holdSlot(
      { practitionerId: "spec-3", serviceType: "niskoplatna", startsAt: "2025-06-02T10:00:00Z", patientContact: contact },
      holdNow
    );
    const appt = await confirmPayment(held.id, holdNow);

    const now = new Date("2026-09-01T10:00:00Z"); // months later — well past the 6-week cutoff
    const before = await getPatientsToRemind("spec-3", now);
    const candidateBefore = before.find((c) => c.patient.id === appt.patientId);
    assert.ok(candidateBefore, "should be a reminder candidate");
    assert.equal(candidateBefore!.lastReminderSentAt, null);

    await sendVisitReminderEmail(appt.patientId, now);
    const after = await getPatientsToRemind("spec-3", now);
    const candidateAfter = after.find((c) => c.patient.id === appt.patientId);
    assert.ok(candidateAfter?.lastReminderSentAt, "lastReminderSentAt should be set after sending");
    assert.equal(new Date(candidateAfter!.lastReminderSentAt!).getTime(), now.getTime());

    const noEmailHeld = await holdSlot(
      { practitionerId: "spec-3", serviceType: "niskoplatna", startsAt: "2025-06-03T10:00:00Z", patientContact: noEmailContact },
      holdNow
    );
    const noEmailAppt = await confirmPayment(noEmailHeld.id, holdNow);
    await assert.rejects(
      () => sendVisitReminderEmail(noEmailAppt.patientId, now),
      "a patient with no email on file shouldn't be emailable"
    );
  }

  // Practitioner-side cancel/reschedule: no 24h/reschedule-cap guardrails
  // (those are patient self-service limits), but ownership is enforced.
  {
    const now = new Date("2026-09-01T10:00:00Z");
    const held = await holdSlot({ practitionerId: "spec-1", serviceType: "niskoplatna", startsAt: "2026-09-01T20:00:00Z", patientContact: contact }, now);
    const appt = await confirmPayment(held.id, now);
    assert.equal(canManage(appt, now).canCancel, false); // <24h — would reject the patient-side call

    await assert.rejects(() => cancelAppointmentAsPractitioner(appt.id, "someone-elses-id", now));
    const moved = await rescheduleAppointmentAsPractitioner(appt.id, "spec-1", "2026-09-01T21:00:00Z", now);
    assert.equal(moved.startsAt, "2026-09-01T21:00:00Z");
    const cancelled = await cancelAppointmentAsPractitioner(moved.id, "spec-1", now);
    assert.equal(cancelled.status, "cancelled");
  }

  console.log("appointments.ts self-check passed");
}

main().finally(async () => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  // patient contact info now lives in `patients`, keyed by phone — delete
  // this run's appointments via that row instead of a patient_email column.
  for (const phone of [contactPhoneStored, noEmailPhoneStored]) {
    const { data: patient } = await db.from("patients").select("id").eq("phone", phone).maybeSingle();
    if (patient) await db.from("appointments").delete().eq("patient_id", patient.id);
  }
});

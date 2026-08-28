// One-off: a few confirmed demo appointments so the doctor panel isn't empty
// when checking it manually. Safe to rerun — each appointment uses a fresh
// startsAt a few days out, so it won't collide with a previous run's rows.
//
// Run with: pnpm seed:appointments
import { confirmPayment, holdSlot } from "../src/lib/appointments";

const DAY_MS = 24 * 3_600_000;

const demoAppointments = [
  { specialistId: "spec-1", serviceType: "niskoplatna" as const, daysAhead: 2, hour: 10, patient: "Kasia Zielińska" },
  { specialistId: "spec-1", serviceType: "pelnoplatna" as const, daysAhead: 3, hour: 12, patient: "Tomasz Krawczyk" },
  { specialistId: "spec-2", serviceType: "adhd_diagnoza" as const, daysAhead: 2, hour: 14, patient: "Piotr Malinowski" },
  { specialistId: "spec-3", serviceType: "bezplatna" as const, daysAhead: 4, hour: 9, patient: "Ewa Sokołowska" },
];

async function main() {
  const now = new Date();

  for (const demo of demoAppointments) {
    const startsAt = new Date(now.getTime() + demo.daysAhead * DAY_MS);
    startsAt.setHours(demo.hour, 0, 0, 0);

    const held = await holdSlot(
      {
        specialistId: demo.specialistId,
        serviceType: demo.serviceType,
        startsAt: startsAt.toISOString(),
        patientContact: { name: demo.patient, email: `${demo.patient.split(" ")[0].toLowerCase()}@example.com`, phone: "500100200" },
      },
      now
    );
    await confirmPayment(held.id, now);
    console.log(`confirmed ${demo.specialistId} ${demo.serviceType} @ ${startsAt.toISOString()} for ${demo.patient}`);
  }
}

main();

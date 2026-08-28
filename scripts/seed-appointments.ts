// One-off: a few confirmed demo appointments so the doctor panel isn't empty
// when checking it manually. Safe to rerun — each appointment uses a fresh
// startsAt a few days out, so it won't collide with a previous run's rows.
//
// Run with: pnpm seed:appointments
import { confirmPayment, holdSlot } from "../src/lib/appointments";

const DAY_MS = 24 * 3_600_000;

// Distinct phones per demo patient — patients dedup by phone, so sharing one
// number across all four would collapse them into a single patient record.
const demoAppointments = [
  { practitionerId: "spec-1", serviceType: "niskoplatna" as const, daysAhead: 2, hour: 10, patient: "Kasia Zielińska", phone: "500100201" },
  { practitionerId: "spec-1", serviceType: "pelnoplatna" as const, daysAhead: 3, hour: 12, patient: "Tomasz Krawczyk", phone: "500100202" },
  { practitionerId: "spec-2", serviceType: "adhd_diagnoza" as const, daysAhead: 2, hour: 14, patient: "Piotr Malinowski", phone: "500100203" },
  { practitionerId: "spec-3", serviceType: "bezplatna" as const, daysAhead: 4, hour: 9, patient: "Ewa Sokołowska", phone: "500100204" },
];

async function main() {
  const now = new Date();

  for (const demo of demoAppointments) {
    const startsAt = new Date(now.getTime() + demo.daysAhead * DAY_MS);
    startsAt.setHours(demo.hour, 0, 0, 0);

    const held = await holdSlot(
      {
        practitionerId: demo.practitionerId,
        serviceType: demo.serviceType,
        startsAt: startsAt.toISOString(),
        patientContact: { name: demo.patient, email: `${demo.patient.split(" ")[0].toLowerCase()}@example.com`, phone: demo.phone },
      },
      now
    );
    await confirmPayment(held.id, now);
    console.log(`confirmed ${demo.practitionerId} ${demo.serviceType} @ ${startsAt.toISOString()} for ${demo.patient}`);
  }
}

main();

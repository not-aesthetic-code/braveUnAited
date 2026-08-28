// Demo visits spread across the next 7 days — the window /panel/dostepnosc
// actually renders — so the hour grid shows real merged blocks instead of an
// empty week. Deliberately mixed service types, because the grid colours and
// labels them per type, and a 90-minute ADHD diagnosis has to visibly span
// two hour rows.
//
// Rerunnable: rows use deterministic ids, so a second run moves the same
// visits to the current week rather than piling up duplicates.
//
// Run with: pnpm seed:panel-week
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const WARSAW = "Europe/Warsaw";

type Demo = {
  slot: number; // stable id suffix
  practitionerId: string;
  serviceId: string;
  price: number;
  daysAhead: number;
  hour: number;
  status: "confirmed" | "completed" | "held";
  paymentStatus: "paid" | "pending";
  patient: { name: string; email: string; phone: string };
};

const PATIENTS = {
  ada: { name: "Ada Lewandowska", email: "ada.lewandowska@example.com", phone: "500300101" },
  bartek: { name: "Bartek Zawadzki", email: "bartek.zawadzki@example.com", phone: "500300102" },
  celina: { name: "Celina Dąbrowska", email: "celina.dabrowska@example.com", phone: "500300103" },
  damian: { name: "Damian Olszewski", email: "", phone: "500300104" },
  ewa: { name: "Ewa Górska", email: "ewa.gorska@example.com", phone: "500300105" },
};

// Every practitioner gets a week, so the grid is populated no matter who logs in.
const DEMO: Demo[] = ["spec-1", "spec-2", "spec-3"].flatMap((practitionerId, index) => {
  const base = (index + 1) * 100;
  return [
    { slot: base + 1, practitionerId, serviceId: "adhd_diagnoza", price: 350, daysAhead: 1, hour: 14, status: "confirmed", paymentStatus: "paid", patient: PATIENTS.ada },
    { slot: base + 2, practitionerId, serviceId: "niskoplatna", price: 55, daysAhead: 1, hour: 9, status: "confirmed", paymentStatus: "paid", patient: PATIENTS.bartek },
    { slot: base + 3, practitionerId, serviceId: "pelnoplatna", price: 135, daysAhead: 2, hour: 11, status: "confirmed", paymentStatus: "paid", patient: PATIENTS.celina },
    { slot: base + 4, practitionerId, serviceId: "bezplatna", price: 0, daysAhead: 3, hour: 10, status: "confirmed", paymentStatus: "paid", patient: PATIENTS.damian },
    { slot: base + 5, practitionerId, serviceId: "adhd_diagnoza", price: 350, daysAhead: 4, hour: 16, status: "confirmed", paymentStatus: "paid", patient: PATIENTS.ewa },
    { slot: base + 6, practitionerId, serviceId: "pelnoplatna", price: 125, daysAhead: 5, hour: 12, status: "held", paymentStatus: "pending", patient: PATIENTS.ada },
    { slot: base + 7, practitionerId, serviceId: "niskoplatna", price: 55, daysAhead: 6, hour: 15, status: "confirmed", paymentStatus: "paid", patient: PATIENTS.celina },
  ] satisfies Demo[];
});

const demoId = (slot: number) => `30000000-0000-4000-8000-${String(slot).padStart(12, "0")}`;

/** Warsaw wall time -> the matching UTC instant, DST included. */
function warsawToUtc(date: string, hour: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, 0);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: WARSAW, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let instant = wanted;
  for (let i = 0; i < 2; i += 1) {
    const parts = format.formatToParts(new Date(instant));
    const at = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    const rendered = Date.UTC(at("year"), at("month") - 1, at("day"), at("hour"), at("minute"), at("second"));
    instant = wanted - (rendered - instant);
  }
  return new Date(instant).toISOString();
}

function warsawDate(daysAhead: number): string {
  const value = new Date(Date.now() + daysAhead * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: WARSAW }).format(value);
}

async function upsertPatient(patient: { name: string; email: string; phone: string }): Promise<string> {
  const existing = await db.from("patients").select("id").eq("phone", patient.phone).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id as string;

  const inserted = await db
    .from("patients")
    .insert({ name: patient.name, email: patient.email || null, phone: patient.phone })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id as string;
}

async function main() {
  // Drop the previous run first: ids are stable, but the dates are not, so
  // an upsert would leave last week's rows sitting in the grid.
  const removed = await db.from("appointments").delete().in("id", DEMO.map((d) => demoId(d.slot)));
  if (removed.error) throw removed.error;

  const rows = [];
  for (const demo of DEMO) {
    rows.push({
      id: demoId(demo.slot),
      practitioner_id: demo.practitionerId,
      service_id: demo.serviceId,
      starts_at: warsawToUtc(warsawDate(demo.daysAhead), demo.hour),
      status: demo.status,
      held_until: demo.status === "held" ? new Date(Date.now() + 3_600_000).toISOString() : null,
      patient_id: await upsertPatient(demo.patient),
      price: demo.price,
      reschedule_count: 0,
      payment_status: demo.paymentStatus,
    });
  }

  const { error } = await db.from("appointments").insert(rows);
  if (error) throw error;

  console.log(`Wstawiono ${rows.length} demonstracyjnych wizyt (${DEMO.length / 3} na specjalistę, 7 dni do przodu).`);
  console.log("Diagnozy ADHD trwają 90 minut — w siatce zajmują dwa wiersze godzin.");
}

main();

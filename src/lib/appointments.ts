// Shared data layer for the booking slice. Backed by Supabase Postgres
// (see supabase/migrations/) via the service_role key — this module is
// server-only (Server Components / Server Actions), so that key never
// reaches the browser.

export type ServiceType =
  | "niskoplatna"
  | "pelnoplatna"
  | "adhd_diagnoza"
  | "asystent_zdrowienia"
  | "bezplatna";

export type AppointmentStatus =
  | "held"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type PatientContact = { name: string; email: string; phone: string };

export type Appointment = {
  id: string;
  specialistId: string;
  serviceType: ServiceType;
  startsAt: string; // ISO
  status: AppointmentStatus;
  heldUntil?: string; // ISO, set while status === "held"
  patientContact: PatientContact;
  price: number; // PLN
  rescheduleCount: number; // 0..MAX_RESCHEDULES
  paymentStatus: "pending" | "paid" | "refund_due" | "refunded";
};

export const HOLD_MINUTES = 10;
export const CANCEL_WINDOW_HOURS = 24;
export const MAX_RESCHEDULES = 2;
export const MIN_LEAD_HOURS = 2;

// pełnopłatna has no single price — each specialist picks one of these four
// fixed rates. Everything else is a flat price.
export const PELNOPLATNA_RATES = [115, 125, 135, 145] as const;

export const PRICE_BY_SERVICE: Record<Exclude<ServiceType, "pelnoplatna">, number> = {
  niskoplatna: 55,
  adhd_diagnoza: 350,
  asystent_zdrowienia: 37,
  bezplatna: 0,
};

export const SERVICE_LABELS: Record<ServiceType, { title: string; description: string }> = {
  niskoplatna: { title: "Konsultacja niskopłatna", description: "Do 10 wizyt na pacjenta" },
  pelnoplatna: { title: "Konsultacja pełnopłatna", description: "Stawka zależna od specjalisty" },
  adhd_diagnoza: { title: "Diagnoza ADHD", description: "90 minut" },
  asystent_zdrowienia: { title: "Asystent zdrowienia", description: "Wsparcie między sesjami" },
  bezplatna: { title: "Bezpłatna konsultacja", description: "Pierwszy kontakt, bez opłat" },
};

export function priceLabel(serviceType: ServiceType): string {
  if (serviceType === "pelnoplatna") {
    return `${PELNOPLATNA_RATES[0]}–${PELNOPLATNA_RATES[PELNOPLATNA_RATES.length - 1]} zł`;
  }
  const price = PRICE_BY_SERVICE[serviceType];
  return price > 0 ? `${price} zł` : "Bezpłatnie";
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — a top-level createClient() call would throw at build
// time before SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are configured.
let _db: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return _db;
}

type Row = {
  id: string;
  specialist_id: string;
  service_type: ServiceType;
  starts_at: string;
  status: AppointmentStatus;
  held_until: string | null;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  price: number;
  reschedule_count: number;
  payment_status: Appointment["paymentStatus"];
};

function fromRow(r: Row): Appointment {
  return {
    id: r.id,
    specialistId: r.specialist_id,
    serviceType: r.service_type,
    startsAt: r.starts_at,
    status: r.status,
    heldUntil: r.held_until ?? undefined,
    patientContact: { name: r.patient_name, email: r.patient_email, phone: r.patient_phone },
    price: r.price,
    rescheduleCount: r.reschedule_count,
    paymentStatus: r.payment_status,
  };
}

// A hold blocks the slot only until it expires — treat it as free again
// afterwards instead of leaving a dead "held" record in the way.
async function expireIfStale(appt: Appointment, now: Date): Promise<Appointment> {
  if (appt.status === "held" && appt.heldUntil && new Date(appt.heldUntil) <= now) {
    await db().from("appointments").update({ status: "cancelled" }).eq("id", appt.id).eq("status", "held");
    appt.status = "cancelled";
  }
  return appt;
}

export async function getAppointment(id: string, now = new Date()): Promise<Appointment | undefined> {
  const { data, error } = await db().from("appointments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? expireIfStale(fromRow(data as Row), now) : undefined;
}

export async function holdSlot(input: {
  specialistId: string;
  serviceType: ServiceType;
  startsAt: string;
  patientContact: PatientContact;
}, now = new Date()): Promise<Appointment> {
  if (new Date(input.startsAt).getTime() - now.getTime() < MIN_LEAD_HOURS * 3_600_000) {
    throw new Error(`must book at least ${MIN_LEAD_HOURS}h in advance`);
  }
  // Clear a stale hold on this exact slot first, otherwise the unique index
  // below rejects the new hold even though the old one already expired.
  await db()
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("specialist_id", input.specialistId)
    .eq("starts_at", input.startsAt)
    .eq("status", "held")
    .lt("held_until", now.toISOString());

  const heldUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
  const { data, error } = await db()
    .from("appointments")
    .insert({
      specialist_id: input.specialistId,
      service_type: input.serviceType,
      starts_at: input.startsAt,
      status: "held",
      held_until: heldUntil,
      patient_name: input.patientContact.name,
      patient_email: input.patientContact.email,
      patient_phone: input.patientContact.phone,
      price: priceFor(input.serviceType, input.specialistId),
      payment_status: "pending",
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("ten termin został już zarezerwowany — wybierz inny");
    throw error;
  }
  return fromRow(data as Row);
}

export async function confirmPayment(id: string, now = new Date()): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (appt.status !== "held") throw new Error("hold expired or already confirmed");
  const { data, error } = await db()
    .from("appointments")
    .update({ status: "confirmed", payment_status: "paid" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

function hoursUntil(appt: Appointment, now: Date): number {
  return (new Date(appt.startsAt).getTime() - now.getTime()) / 3_600_000;
}

export function canManage(appt: Appointment, now = new Date()) {
  const hours = hoursUntil(appt, now);
  const withinFreeWindow = hours >= CANCEL_WINDOW_HOURS;
  return {
    hoursUntil: hours,
    canCancel: appt.status === "confirmed" && withinFreeWindow,
    canReschedule:
      appt.status === "confirmed" &&
      withinFreeWindow &&
      appt.rescheduleCount < MAX_RESCHEDULES,
  };
}

// Rules are enforced here, not just hidden in the UI — this is the trust
// boundary, a patient could otherwise hit the endpoint directly.
export async function cancelAppointment(id: string, now = new Date()): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (!canManage(appt, now).canCancel) {
    throw new Error("cancellation window has passed — contact the specialist directly");
  }
  const { data, error } = await db()
    .from("appointments")
    .update({ status: "cancelled", payment_status: appt.price > 0 ? "refund_due" : appt.paymentStatus })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function rescheduleAppointment(id: string, newStartsAt: string, now = new Date()): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (!canManage(appt, now).canReschedule) {
    throw new Error("reschedule window has passed or limit reached");
  }
  const { data, error } = await db()
    .from("appointments")
    .update({ starts_at: newStartsAt, reschedule_count: appt.rescheduleCount + 1 })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

// --- Demo slot search --------------------------------------------------

const SPECIALISTS = [
  { id: "spec-1", name: "Anna Kowalska", services: ["niskoplatna", "pelnoplatna"] as ServiceType[], pelnoplatnaRate: 125 },
  { id: "spec-2", name: "Marek Nowak", services: ["pelnoplatna", "adhd_diagnoza"] as ServiceType[], pelnoplatnaRate: 145 },
  { id: "spec-3", name: "Ola Wiśniewska", services: ["asystent_zdrowienia", "bezplatna"] as ServiceType[] },
];

function priceFor(serviceType: ServiceType, specialistId: string): number {
  if (serviceType === "pelnoplatna") {
    return SPECIALISTS.find((s) => s.id === specialistId)?.pelnoplatnaRate ?? PELNOPLATNA_RATES[0];
  }
  return PRICE_BY_SERVICE[serviceType];
}

const REGULAR_SLOT_MINUTES = 50;
const ADHD_SLOT_MINUTES = 90;
const SLOT_BUFFER_MINUTES = 10;
const MAX_SLOT_DAYS_AHEAD = 7; // specialists publish availability at most a week out
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;

export type Slot = { specialistId: string; specialistName: string; serviceType: ServiceType; startsAt: string; price: number };

function sessionMinutes(serviceType: ServiceType): number {
  return serviceType === "adhd_diagnoza" ? ADHD_SLOT_MINUTES : REGULAR_SLOT_MINUTES;
}

// Slots are duration + buffer apart (50min sessions, 90min ADHD, 10min buffer
// between), starting at least MIN_LEAD_HOURS from now — matches the real
// scheduling constraints, not just an arbitrary hourly grid.
//
// A specialist has one calendar across all service types: booked time ranges
// (not just exact start-time matches) block slots for every service, so an
// ADHD visit (90min) can't be double-booked by a 50min niskoplatna slot that
// starts partway through it.
export async function listAvailableSlots(serviceType: ServiceType, now = new Date()): Promise<Slot[]> {
  const { data, error } = await db()
    .from("appointments")
    .select("specialist_id, starts_at, service_type, status, held_until")
    .neq("status", "cancelled");
  if (error) throw error;

  const busy = (data ?? [])
    .filter((a) => !(a.status === "held" && a.held_until && new Date(a.held_until) <= now))
    .map((a) => {
      const start = new Date(a.starts_at).getTime();
      return {
        specialistId: a.specialist_id as string,
        start,
        end: start + sessionMinutes(a.service_type as ServiceType) * 60_000,
      };
    });

  const slots: Slot[] = [];
  const specialists = SPECIALISTS.filter((s) => s.services.includes(serviceType));
  const durationMinutes = serviceType === "adhd_diagnoza" ? ADHD_SLOT_MINUTES : REGULAR_SLOT_MINUTES;
  const minStart = new Date(now.getTime() + MIN_LEAD_HOURS * 3_600_000);

  for (let dayOffset = 0; dayOffset <= MAX_SLOT_DAYS_AHEAD; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    const dayEnd = new Date(day);
    dayEnd.setHours(WORK_END_HOUR, 0, 0, 0);

    for (const spec of specialists) {
      const cursor = new Date(day);
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
      while (cursor.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
        if (cursor >= minStart) {
          const candidateStart = cursor.getTime();
          const candidateEnd = candidateStart + durationMinutes * 60_000;
          const overlaps = busy.some(
            (b) => b.specialistId === spec.id && b.start < candidateEnd && candidateStart < b.end
          );
          if (!overlaps) {
            slots.push({
              specialistId: spec.id,
              specialistName: spec.name,
              serviceType,
              startsAt: cursor.toISOString(),
              price: priceFor(serviceType, spec.id),
            });
          }
        }
        cursor.setMinutes(cursor.getMinutes() + durationMinutes + SLOT_BUFFER_MINUTES);
      }
    }
  }
  return slots;
}

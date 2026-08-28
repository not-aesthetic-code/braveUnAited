// Shared data layer for the booking slice. In-memory only — good enough for a
// demo; swap for a real store if the day allows it. Single process, so this
// resets on every server restart/deploy.

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

const store = new Map<string, Appointment>();

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// A hold blocks the slot only until it expires — treat it as free again
// afterwards instead of leaving a dead "held" record in the way.
function expireIfStale(appt: Appointment, now: Date): Appointment {
  if (appt.status === "held" && appt.heldUntil && new Date(appt.heldUntil) <= now) {
    appt.status = "cancelled";
  }
  return appt;
}

export function getAppointment(id: string, now = new Date()): Appointment | undefined {
  const appt = store.get(id);
  return appt ? expireIfStale(appt, now) : undefined;
}

export function holdSlot(input: {
  specialistId: string;
  serviceType: ServiceType;
  startsAt: string;
  patientContact: PatientContact;
}, now = new Date()): Appointment {
  if (new Date(input.startsAt).getTime() - now.getTime() < MIN_LEAD_HOURS * 3_600_000) {
    throw new Error(`must book at least ${MIN_LEAD_HOURS}h in advance`);
  }
  const heldUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
  const appt: Appointment = {
    id: generateId(),
    specialistId: input.specialistId,
    serviceType: input.serviceType,
    startsAt: input.startsAt,
    status: "held",
    heldUntil,
    patientContact: input.patientContact,
    price: priceFor(input.serviceType, input.specialistId),
    rescheduleCount: 0,
    paymentStatus: "pending",
  };
  store.set(appt.id, appt);
  return appt;
}

export function confirmPayment(id: string, now = new Date()): Appointment {
  const appt = getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (appt.status !== "held") throw new Error("hold expired or already confirmed");
  appt.status = "confirmed";
  appt.paymentStatus = "paid";
  return appt;
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
export function cancelAppointment(id: string, now = new Date()): Appointment {
  const appt = getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (!canManage(appt, now).canCancel) {
    throw new Error("cancellation window has passed — contact the specialist directly");
  }
  appt.status = "cancelled";
  appt.paymentStatus = appt.price > 0 ? "refund_due" : appt.paymentStatus;
  return appt;
}

export function rescheduleAppointment(id: string, newStartsAt: string, now = new Date()): Appointment {
  const appt = getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (!canManage(appt, now).canReschedule) {
    throw new Error("reschedule window has passed or limit reached");
  }
  appt.startsAt = newStartsAt;
  appt.rescheduleCount += 1;
  return appt;
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

// Slots are duration + buffer apart (50min sessions, 90min ADHD, 10min buffer
// between), starting at least MIN_LEAD_HOURS from now — matches the real
// scheduling constraints, not just an arbitrary hourly grid.
export function listAvailableSlots(serviceType: ServiceType, now = new Date()): Slot[] {
  const taken = new Set(
    [...store.values()]
      .filter((a) => expireIfStale(a, now).status !== "cancelled")
      .map((a) => `${a.specialistId}|${a.startsAt}`)
  );

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
          const iso = cursor.toISOString();
          if (!taken.has(`${spec.id}|${iso}`)) {
            slots.push({
              specialistId: spec.id,
              specialistName: spec.name,
              serviceType,
              startsAt: iso,
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

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

export const PRICE_BY_SERVICE: Record<ServiceType, number> = {
  niskoplatna: 55,
  pelnoplatna: 135,
  adhd_diagnoza: 750,
  asystent_zdrowienia: 37,
  bezplatna: 0,
};

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
  const heldUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
  const appt: Appointment = {
    id: generateId(),
    specialistId: input.specialistId,
    serviceType: input.serviceType,
    startsAt: input.startsAt,
    status: "held",
    heldUntil,
    patientContact: input.patientContact,
    price: PRICE_BY_SERVICE[input.serviceType],
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
  { id: "spec-1", name: "Anna Kowalska", services: ["niskoplatna", "pelnoplatna"] as ServiceType[] },
  { id: "spec-2", name: "Marek Nowak", services: ["pelnoplatna", "adhd_diagnoza"] as ServiceType[] },
  { id: "spec-3", name: "Ola Wiśniewska", services: ["asystent_zdrowienia", "bezplatna"] as ServiceType[] },
];

export type Slot = { specialistId: string; specialistName: string; serviceType: ServiceType; startsAt: string };

// Hourly 9-17 slots for the next 5 weekdays, minus anything already
// held/confirmed. Enough to demo search without a real scheduling backend.
export function listAvailableSlots(serviceType: ServiceType, now = new Date()): Slot[] {
  const taken = new Set(
    [...store.values()]
      .filter((a) => expireIfStale(a, now).status !== "cancelled")
      .map((a) => `${a.specialistId}|${a.startsAt}`)
  );

  const slots: Slot[] = [];
  const specialists = SPECIALISTS.filter((s) => s.services.includes(serviceType));

  for (let dayOffset = 1; dayOffset <= 5; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    for (const spec of specialists) {
      for (let hour = 9; hour < 17; hour++) {
        const startsAt = new Date(day);
        startsAt.setHours(hour, 0, 0, 0);
        const iso = startsAt.toISOString();
        if (!taken.has(`${spec.id}|${iso}`)) {
          slots.push({ specialistId: spec.id, specialistName: spec.name, serviceType, startsAt: iso });
        }
      }
    }
  }
  return slots;
}

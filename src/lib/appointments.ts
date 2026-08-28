// Shared data layer for the booking slice. Backed by Supabase Postgres
// (see supabase/migrations/) via the service_role key — this module is
// server-only (Server Components / Server Actions), so that key never
// reaches the browser.

// Service catalog now lives in the `services` table (title/description/
// duration/buffer/price), but the set of ids is small and fixed enough that
// keeping a compile-time union here is worth it — callers like
// isServiceType() in book/page.tsx need to validate an untrusted query param
// without a DB round trip.
export const SERVICE_TYPES = [
  "niskoplatna",
  "pelnoplatna",
  "adhd_diagnoza",
  "asystent_zdrowienia",
  "bezplatna",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export type AppointmentStatus =
  | "held"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type PatientContact = { name: string; email: string; phone: string };

export type Service = {
  id: ServiceType;
  title: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  basePrice: number | null; // null = variable, priced per practitioner (pelnoplatna)
};

export type Practitioner = {
  id: string;
  name: string;
  services: { serviceId: ServiceType; priceOverride: number | null }[];
  meetingInfo: string | null; // video link or address, shown on confirmation
  email: string | null; // contact for "write to specialist" once the free-cancellation window has passed
};

// Optional reason a patient gives when cancelling within the free window.
// Feeds aggregate foundation stats; the practitioner only ever sees it on
// their own appointment (getAppointmentsForPractitioner already scopes that).
export const CANCEL_REASONS = [
  { value: "choroba", label: "Choroba" },
  { value: "kolizja_obowiazkow", label: "Kolizja z obowiązkami" },
  { value: "nie_potrzebuje_juz", label: "Nie potrzebuję już wizyty" },
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number]["value"];

export type Appointment = {
  id: string;
  practitionerId: string;
  serviceId: ServiceType;
  service: Service;
  startsAt: string; // ISO
  status: AppointmentStatus;
  heldUntil?: string; // ISO, set while status === "held"
  patientId: string;
  patient: { id: string; name: string; email: string; phone: string };
  price: number; // PLN
  rescheduleCount: number; // 0..MAX_RESCHEDULES
  paymentStatus: "pending" | "paid" | "refund_due" | "refunded";
  cancelReason: CancelReason | null;
};

export const HOLD_MINUTES = 10;
export const CANCEL_WINDOW_HOURS = 24;
export const MAX_RESCHEDULES = 2;
export const MIN_LEAD_HOURS = 2;
// A specialist has this long after a session ends to explicitly mark
// completed/no_show before the system defaults it to "completed" — see
// expireIfStale().
export const ATTENDANCE_GRACE_HOURS = 48;

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isValidEmail } from "./email-format";
import { sendEmail } from "./email";
import { normalizePolishPhone } from "./phone";
import { sendSms } from "./sms";

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

const APPOINTMENT_SELECT = "*, patient:patients(*), service:services(*)";

type ServiceRow = {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  buffer_minutes: number;
  base_price: number | null;
};

function fromServiceRow(r: ServiceRow): Service {
  return {
    id: r.id as ServiceType,
    title: r.title,
    description: r.description,
    durationMinutes: r.duration_minutes,
    bufferMinutes: r.buffer_minutes,
    basePrice: r.base_price,
  };
}

type Row = {
  id: string;
  practitioner_id: string;
  service_id: ServiceType;
  service: ServiceRow;
  starts_at: string;
  status: AppointmentStatus;
  held_until: string | null;
  patient_id: string;
  patient: { id: string; name: string; email: string; phone: string };
  price: number;
  reschedule_count: number;
  payment_status: Appointment["paymentStatus"];
  cancel_reason: CancelReason | null;
};

function fromRow(r: Row): Appointment {
  return {
    id: r.id,
    practitionerId: r.practitioner_id,
    serviceId: r.service_id,
    service: fromServiceRow(r.service),
    startsAt: r.starts_at,
    status: r.status,
    heldUntil: r.held_until ?? undefined,
    patientId: r.patient_id,
    patient: r.patient,
    price: r.price,
    rescheduleCount: r.reschedule_count,
    paymentStatus: r.payment_status,
    cancelReason: r.cancel_reason,
  };
}

function appointmentEndsAt(appt: Appointment): number {
  return new Date(appt.startsAt).getTime() + appt.service.durationMinutes * 60_000;
}

// A hold blocks the slot only until it expires — treat it as free again
// afterwards instead of leaving a dead "held" record in the way. Likewise, a
// confirmed appointment nobody explicitly marked completed/no_show for
// eventually defaults to "completed" (ATTENDANCE_GRACE_HOURS after it ends)
// — a specialist who forgets to attend to a past visit shouldn't leave it
// stuck reading "confirmed" forever.
async function expireIfStale(appt: Appointment, now: Date): Promise<Appointment> {
  if (appt.status === "held" && appt.heldUntil && new Date(appt.heldUntil) <= now) {
    await db().from("appointments").update({ status: "cancelled" }).eq("id", appt.id).eq("status", "held");
    appt.status = "cancelled";
  } else if (appt.status === "confirmed" && appointmentEndsAt(appt) + ATTENDANCE_GRACE_HOURS * 3_600_000 <= now.getTime()) {
    await db().from("appointments").update({ status: "completed" }).eq("id", appt.id).eq("status", "confirmed");
    appt.status = "completed";
  }
  return appt;
}

export async function getAppointment(id: string, now = new Date()): Promise<Appointment | undefined> {
  const { data, error } = await db().from("appointments").select(APPOINTMENT_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? expireIfStale(fromRow(data as Row), now) : undefined;
}

// Dedup key is phone — the only identifier guest booking reliably collects.
// Normalized first (see phone.ts — +48 is hardcoded, every patient is
// Polish) so "600 100 200" and "600-100-200" from two different bookings
// resolve to the same patient instead of two rows — the `patients.phone`
// column is `unique`, so an unnormalized duplicate would otherwise fail the
// insert instead of merging.
// Never overwrite an already-set email on conflict: /konto looks bookings up
// by email, so silently moving a patient's email to whatever they typed on
// their latest booking would strand their older bookings under the old one.
async function upsertPatientByPhone(contact: PatientContact): Promise<{ id: string }> {
  const phone = normalizePolishPhone(contact.phone);
  if (!phone) throw new Error("podaj poprawny polski numer telefonu, np. 600 123 456");
  // Email is optional, but if given it must look real — it's used for the
  // confirmation link and, via /konto, as a login identifier.
  if (contact.email && !isValidEmail(contact.email)) {
    throw new Error("podaj poprawny adres e-mail albo zostaw pole puste");
  }

  const { data: existing, error: lookupError } = await db()
    .from("patients")
    .select("id, email")
    .eq("phone", phone)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const patch: { name: string; email?: string } = { name: contact.name };
    if (!existing.email && contact.email) patch.email = contact.email;
    const { data, error } = await db().from("patients").update(patch).eq("id", existing.id).select("id").single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await db()
    .from("patients")
    .insert({ name: contact.name, email: contact.email || null, phone })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function holdSlot(input: {
  practitionerId: string;
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
    .eq("practitioner_id", input.practitionerId)
    .eq("starts_at", input.startsAt)
    .eq("status", "held")
    .lt("held_until", now.toISOString());

  const heldUntil = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
  const [practitioners, service, patient] = await Promise.all([
    getPractitioners(),
    getService(input.serviceType),
    upsertPatientByPhone(input.patientContact),
  ]);
  if (!service) throw new Error("unknown service");

  const { data, error } = await db()
    .from("appointments")
    .insert({
      practitioner_id: input.practitionerId,
      service_id: input.serviceType,
      starts_at: input.startsAt,
      status: "held",
      held_until: heldUntil,
      patient_id: patient.id,
      price: priceFor(input.serviceType, input.practitionerId, practitioners, service),
      payment_status: "pending",
    })
    .select(APPOINTMENT_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("ten termin został już zarezerwowany — wybierz inny");
    throw error;
  }
  return fromRow(data as Row);
}

// Text is fixed and holds no service name or health-related wording (see
// plan.md's business rules — "no service name, no health-related words"),
// since an SMS can be read by anyone with the patient's phone in hand. Also
// avoids Polish diacritics: they'd force UCS-2 encoding and cut the single-
// segment budget from 160 chars to 70 ("character-limited (segment cost)").
export function buildConfirmationSmsText(startsAt: string, meetingInfo: string | null): string {
  const when = new Date(startsAt).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const info = meetingInfo ? `${meetingInfo}. ` : "";
  return `Niepodzielni: potwierdzamy wizyte ${when}. ${info}Pytania? Zadzwon do nas.`;
}

export async function confirmPayment(id: string, now = new Date()): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (appt.status !== "held") throw new Error("hold expired or already confirmed");
  const { data, error } = await db()
    .from("appointments")
    .update({ status: "confirmed", payment_status: "paid" })
    .eq("id", id)
    .select(APPOINTMENT_SELECT)
    .single();
  if (error) throw error;
  const confirmed = fromRow(data as Row);
  const practitioner = await getPractitioner(confirmed.practitionerId);

  // Phone-only guest patients have no email on file — same silent fallback
  // as applyCancel, since confirming must not fail just for lack of an inbox.
  if (confirmed.patient.email) {
    const when = new Date(confirmed.startsAt).toLocaleString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const info = practitioner?.meetingInfo ? ` ${practitioner.meetingInfo}.` : "";
    sendEmail(
      confirmed.patient.email,
      "Wizyta potwierdzona",
      `Cześć ${confirmed.patient.name}, Twoja wizyta ${when} została potwierdzona.${info}`
    );
  }

  // ADHD diagnoza is the longest, highest-stakes session in this slice —
  // send an SMS reminder on top of the confirmation screen. No SMS provider
  // is wired up yet, so this is a stub (src/lib/sms.ts) same as OTP was.
  if (confirmed.serviceId === "adhd_diagnoza") {
    sendSms(confirmed.patient.phone, buildConfirmationSmsText(confirmed.startsAt, practitioner?.meetingInfo ?? null));
  }

  return confirmed;
}

function hoursUntil(appt: Appointment, now: Date): number {
  return (new Date(appt.startsAt).getTime() - now.getTime()) / 3_600_000;
}

// The exact instant the free cancellation/reschedule window closes — shown
// to the patient so the "you can still cancel free until X" copy names a
// real date/time instead of just "24 hours".
export function cancelDeadline(appt: Appointment): Date {
  return new Date(new Date(appt.startsAt).getTime() - CANCEL_WINDOW_HOURS * 3_600_000);
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

async function applyCancel(id: string, appt: Appointment, reason?: CancelReason | null): Promise<Appointment> {
  const { data, error } = await db()
    .from("appointments")
    .update({
      status: "cancelled",
      payment_status: appt.price > 0 ? "refund_due" : appt.paymentStatus,
      cancel_reason: reason ?? null,
    })
    .eq("id", id)
    .select(APPOINTMENT_SELECT)
    .single();
  if (error) throw error;
  const cancelled = fromRow(data as Row);

  // Phone-only guest patients have no email on file — same fallback as
  // sendVisitReminderEmail, but here it's silent since cancelling must not
  // fail just because there's nowhere to send the notice.
  if (cancelled.patient.email) {
    const when = new Date(cancelled.startsAt).toLocaleString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    sendEmail(
      cancelled.patient.email,
      "Wizyta odwołana",
      `Cześć ${cancelled.patient.name}, Twoja wizyta ${when} została odwołana.` +
        (cancelled.paymentStatus === "refund_due" ? " Zwrot płatności zostanie wykonany w 3–5 dni roboczych." : "")
    );
  }

  return cancelled;
}

async function applyReschedule(id: string, appt: Appointment, newStartsAt: string): Promise<Appointment> {
  const { data, error } = await db()
    .from("appointments")
    .update({ starts_at: newStartsAt, reschedule_count: appt.rescheduleCount + 1 })
    .eq("id", id)
    .select(APPOINTMENT_SELECT)
    .single();
  if (error) throw error;
  const rescheduled = fromRow(data as Row);

  // Phone-only guest patients have no email on file — same silent fallback
  // as applyCancel/confirmPayment.
  if (rescheduled.patient.email) {
    const when = new Date(rescheduled.startsAt).toLocaleString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    sendEmail(
      rescheduled.patient.email,
      "Wizyta przełożona",
      `Cześć ${rescheduled.patient.name}, Twoja wizyta została przełożona na ${when}. Specjalista, cena i forma wizyty pozostają bez zmian.`
    );
  }

  return rescheduled;
}

// Rules are enforced here, not just hidden in the UI — this is the trust
// boundary, a patient could otherwise hit the endpoint directly.
export async function cancelAppointment(id: string, reason?: CancelReason | null, now = new Date()): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (!canManage(appt, now).canCancel) {
    throw new Error("cancellation window has passed — contact the specialist directly");
  }
  return applyCancel(id, appt, reason);
}

export async function rescheduleAppointment(id: string, newStartsAt: string, now = new Date()): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (!canManage(appt, now).canReschedule) {
    throw new Error("reschedule window has passed or limit reached");
  }
  return applyReschedule(id, appt, newStartsAt);
}

// Practitioner side: a doctor can cancel or move their own confirmed visits
// any time — the 24h window and reschedule cap in canManage() are patient
// self-service guardrails, not limits on the specialist who owns the slot.
// Ownership is checked here (not just in the UI) since this is the trust
// boundary a logged-in practitioner's request crosses.
export async function cancelAppointmentAsPractitioner(
  id: string,
  practitionerId: string,
  now = new Date()
): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (appt.practitionerId !== practitionerId) throw new Error("not your appointment");
  if (appt.status !== "confirmed") throw new Error("only confirmed appointments can be cancelled");
  return applyCancel(id, appt);
}

// A patient who missed the 24h window and never wrote in, or who simply
// didn't show up, only gets recorded here — by the practitioner, since "the
// decision is a person's, not the system's" (see plan.md). `fullRefund` is
// the specialist's own exception: they can choose to treat a no-show as a
// full-refund cancellation instead, same as if it had happened >24h out.
export async function markNoShow(
  id: string,
  practitionerId: string,
  fullRefund: boolean,
  now = new Date()
): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (appt.practitionerId !== practitionerId) throw new Error("not your appointment");
  if (appt.status !== "confirmed") throw new Error("only confirmed appointments can be marked as no-show");
  if (new Date(appt.startsAt).getTime() > now.getTime()) throw new Error("cannot mark a future appointment as no-show");

  if (fullRefund) return applyCancel(id, appt, null);

  const { data, error } = await db()
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", id)
    .select(APPOINTMENT_SELECT)
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function rescheduleAppointmentAsPractitioner(
  id: string,
  practitionerId: string,
  newStartsAt: string,
  now = new Date()
): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (appt.practitionerId !== practitionerId) throw new Error("not your appointment");
  if (appt.status !== "confirmed") throw new Error("only confirmed appointments can be rescheduled");
  return applyReschedule(id, appt, newStartsAt);
}

// A practitioner's own visit list — same service-role db(), just filtered
// and ordered instead of open-ended, since a doctor only ever needs their own.
export async function getAppointmentsForPractitioner(
  practitionerId: string,
  now = new Date()
): Promise<Appointment[]> {
  const { data, error } = await db()
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("practitioner_id", practitionerId)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return Promise.all(((data ?? []) as Row[]).map((r) => expireIfStale(fromRow(r), now)));
}

export const REMINDER_AFTER_WEEKS = 6;

export type ReminderCandidate = {
  patient: { id: string; name: string; email: string; phone: string };
  lastVisitAt: string; // ISO — most recent confirmed appointment in the past
  lastReminderSentAt: string | null; // ISO — see sendVisitReminderEmail()
};

// Patients a practitioner should reach out to: their most recent confirmed
// appointment was REMINDER_AFTER_WEEKS+ ago, and they have nothing booked
// since. Applies across every service type — nothing here is ADHD-specific,
// unlike the immediate booking-confirmation SMS in confirmPayment(), which
// is a different feature entirely. Outreach is specialist-triggered (see
// sendVisitReminderEmail(), wired to a button in /panel) rather than
// automatic, so a patient isn't re-emailed on every /panel page load.
//
// Includes both "confirmed" (future, or past but still inside the
// ATTENDANCE_GRACE_HOURS window) and "completed" (settled past visits) —
// past visits don't stay "confirmed" forever once expireIfStale() runs, so
// this can't filter on "confirmed" alone without silently losing everyone
// whose last visit already auto-completed.
export async function getPatientsToRemind(
  practitionerId: string,
  now = new Date()
): Promise<ReminderCandidate[]> {
  const { data, error } = await db()
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("practitioner_id", practitionerId)
    .in("status", ["confirmed", "completed"])
    .order("starts_at", { ascending: false });
  if (error) throw error;

  // patients(*) in APPOINTMENT_SELECT already pulls last_reminder_sent_at —
  // it's just not part of the narrower Row/Appointment "patient" shape used
  // elsewhere, so it's read off the raw row instead of threaded through
  // fromRow().
  type RowWithReminderState = Row & { patient: Row["patient"] & { last_reminder_sent_at: string | null } };
  const appts = ((data ?? []) as RowWithReminderState[]).map((r) => ({
    ...fromRow(r),
    lastReminderSentAt: r.patient.last_reminder_sent_at,
  }));
  const nowMs = now.getTime();
  const cutoffMs = nowMs - REMINDER_AFTER_WEEKS * 7 * 86_400_000;

  // Rows are ordered newest-first, so the first past appointment seen per
  // patient is their most recent one.
  const lastPastVisit = new Map<string, (typeof appts)[number]>();
  const hasUpcoming = new Set<string>();
  for (const appt of appts) {
    if (new Date(appt.startsAt).getTime() >= nowMs) {
      hasUpcoming.add(appt.patientId);
    } else if (!lastPastVisit.has(appt.patientId)) {
      lastPastVisit.set(appt.patientId, appt);
    }
  }

  const candidates: ReminderCandidate[] = [];
  for (const [patientId, appt] of lastPastVisit) {
    if (hasUpcoming.has(patientId)) continue;
    if (new Date(appt.startsAt).getTime() <= cutoffMs) {
      candidates.push({ patient: appt.patient, lastVisitAt: appt.startsAt, lastReminderSentAt: appt.lastReminderSentAt });
    }
  }
  return candidates.sort((a, b) => a.lastVisitAt.localeCompare(b.lastVisitAt));
}

// Fires the getPatientsToRemind() outreach as an actual email instead of
// leaving it as a call-list, and records when it went out so /panel can show
// "already sent" instead of offering to resend on every reload. A
// phone-only guest patient has no email to send to — the caller (the
// specialist, via the panel) still has phone/call as the fallback for them.
export async function sendVisitReminderEmail(patientId: string, now = new Date()): Promise<void> {
  const { data: patient, error } = await db().from("patients").select("name, email").eq("id", patientId).single();
  if (error) throw error;
  if (!patient.email) throw new Error("patient has no email on file — call instead");

  sendEmail(
    patient.email,
    "Zapraszamy na kolejną wizytę",
    `Cześć ${patient.name}, minęło trochę czasu od Twojej ostatniej wizyty. Jeśli chcesz umówić kolejną, zajrzyj na naszą stronę.`
  );

  const { error: updateError } = await db()
    .from("patients")
    .update({ last_reminder_sent_at: now.toISOString() })
    .eq("id", patientId);
  if (updateError) throw updateError;
}

// Optional patient account (/konto) — matched by email via Supabase Auth
// magic link, separate from the phone-keyed identity booking uses. A patient
// row's email can be unset (phone-only guest), so this can legitimately
// match zero patients.
export async function getAppointmentsForPatientEmail(
  email: string,
  now = new Date()
): Promise<Appointment[]> {
  const { data: patients, error: patientsError } = await db().from("patients").select("id").eq("email", email);
  if (patientsError) throw patientsError;
  const patientIds = (patients ?? []).map((p) => p.id);
  if (patientIds.length === 0) return [];

  const { data, error } = await db()
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .in("patient_id", patientIds)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return Promise.all(((data ?? []) as Row[]).map((r) => expireIfStale(fromRow(r), now)));
}

// --- Service catalog -----------------------------------------------------

export async function getServices(): Promise<Service[]> {
  const { data, error } = await db().from("services").select("*").order("id");
  if (error) throw error;
  return ((data ?? []) as ServiceRow[]).map(fromServiceRow);
}

export async function getService(id: string): Promise<Service | undefined> {
  const { data, error } = await db().from("services").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromServiceRow(data as ServiceRow) : undefined;
}

// Landing page needs a display price per service: a fixed price, "Bezpłatnie"
// for zero, or a min–max range across practitioners for variable pricing
// (pelnoplatna) — computed from real practitioner_services rows instead of
// the old hardcoded PELNOPLATNA_RATES tuple.
export async function listServicesWithPricing(): Promise<{ service: Service; priceLabel: string }[]> {
  const [services, practitioners] = await Promise.all([getServices(), getPractitioners()]);
  return services.map((service) => {
    if (service.basePrice !== null) {
      return { service, priceLabel: service.basePrice > 0 ? `${service.basePrice} zł` : "Bezpłatnie" };
    }
    const overrides = practitioners
      .flatMap((p) => p.services)
      .filter((s) => s.serviceId === service.id && s.priceOverride != null)
      .map((s) => s.priceOverride!);
    if (overrides.length === 0) return { service, priceLabel: "Cena zależna od specjalisty" };
    const min = Math.min(...overrides);
    const max = Math.max(...overrides);
    return { service, priceLabel: min === max ? `${min} zł` : `${min}–${max} zł` };
  });
}

// --- Practitioners ---------------------------------------------------------

type PractitionerRow = {
  id: string;
  name: string;
  meeting_info: string | null;
  email: string | null;
  practitioner_services: { service_id: ServiceType; price_override: number | null }[];
};

function fromPractitionerRow(r: PractitionerRow): Practitioner {
  return {
    id: r.id,
    name: r.name,
    meetingInfo: r.meeting_info,
    email: r.email,
    services: (r.practitioner_services ?? []).map((ps) => ({ serviceId: ps.service_id, priceOverride: ps.price_override })),
  };
}

const PRACTITIONER_SELECT = "id, name, meeting_info, email, practitioner_services(service_id, price_override)";

export async function getPractitioners(): Promise<Practitioner[]> {
  const { data, error } = await db().from("practitioners").select(PRACTITIONER_SELECT);
  if (error) throw error;
  return ((data ?? []) as PractitionerRow[]).map(fromPractitionerRow);
}

export async function getPractitioner(id: string): Promise<Practitioner | undefined> {
  const { data, error } = await db().from("practitioners").select(PRACTITIONER_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromPractitionerRow(data as PractitionerRow) : undefined;
}

function priceFor(serviceId: ServiceType, practitionerId: string, practitioners: Practitioner[], service: Service): number {
  const override = practitioners
    .find((p) => p.id === practitionerId)
    ?.services.find((s) => s.serviceId === serviceId)?.priceOverride;
  return override ?? service.basePrice ?? 0;
}

// --- Calendars & availability ---------------------------------------------

const MAX_SLOT_DAYS_AHEAD = 7; // practitioners publish availability at most a week out

type AvailabilityRow = { service_id: ServiceType | null; day_of_week: number; start_time: string; end_time: string };
type ExceptionRow = {
  service_id: ServiceType | null;
  date: string;
  kind: "closed" | "open";
  start_time: string | null;
  end_time: string | null;
};

type CalendarInfo = {
  timezone: string;
  availability: AvailabilityRow[];
  exceptions: ExceptionRow[];
};

async function getCalendars(): Promise<Map<string, CalendarInfo>> {
  const { data, error } = await db()
    .from("calendars")
    .select(
      "practitioner_id, timezone, calendar_availability(service_id, day_of_week, start_time, end_time), calendar_exceptions(service_id, date, kind, start_time, end_time)"
    );
  if (error) throw error;
  const map = new Map<string, CalendarInfo>();
  for (const row of (data ?? []) as {
    practitioner_id: string;
    timezone: string;
    calendar_availability: AvailabilityRow[];
    calendar_exceptions: ExceptionRow[];
  }[]) {
    map.set(row.practitioner_id, {
      timezone: row.timezone,
      availability: row.calendar_availability ?? [],
      exceptions: row.calendar_exceptions ?? [],
    });
  }
  return map;
}

// Converts a wall-clock time in a given IANA timezone to the correct UTC
// instant, using the timezone's actual offset for that specific date (so DST
// is handled correctly) instead of assuming the server runs in that zone —
// the previous implementation used server-local Date methods, which was only
// correct if the server happened to run in Europe/Warsaw.
function wallTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const asUTC = new Date(`${dateStr}T${timeStr}Z`);
  const inTz = new Date(asUTC.toLocaleString("en-US", { timeZone }));
  return new Date(asUTC.getTime() + (asUTC.getTime() - inTz.getTime()));
}

function ymdInTimeZone(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone }); // en-CA formats as YYYY-MM-DD
}

type Interval = { start: number; end: number }; // epoch ms

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }
  return merged;
}

function candidateStarts(window: Interval, stepMinutes: number, durationMinutes: number): number[] {
  const starts: number[] = [];
  let cursor = window.start;
  while (cursor + durationMinutes * 60_000 <= window.end) {
    starts.push(cursor);
    cursor += stepMinutes * 60_000;
  }
  return starts;
}

// One day's bookable start times for one practitioner + service. A "closed"
// exception removes whichever candidates it overlaps from the base grid — it
// does NOT shrink/reflow the base window, so 09:00/10:00/11:00... stays on
// the hour even if 10:00 gets blocked, rather than the afternoon sliding to
// match a shortened window. An "open" exception is its own independent
// window with its own cursor, since it's explicitly outside the normal hours.
function slotStartsForDay(
  calendar: CalendarInfo,
  serviceType: ServiceType,
  dateStr: string,
  weekday: number,
  stepMinutes: number,
  durationMinutes: number
): number[] {
  const forThisService = (id: ServiceType | null) => id === null || id === serviceType;

  const baseWindows = mergeIntervals(
    calendar.availability
      .filter((a) => a.day_of_week === weekday && forThisService(a.service_id))
      .map((a) => ({
        start: wallTimeToUtc(dateStr, a.start_time, calendar.timezone).getTime(),
        end: wallTimeToUtc(dateStr, a.end_time, calendar.timezone).getTime(),
      }))
  );

  const dayExceptions = calendar.exceptions.filter((e) => e.date === dateStr && forThisService(e.service_id));

  let starts = baseWindows.flatMap((w) => candidateStarts(w, stepMinutes, durationMinutes));

  const closedRanges = dayExceptions
    .filter((e) => e.kind === "closed")
    .map((e) =>
      e.start_time && e.end_time
        ? {
            start: wallTimeToUtc(dateStr, e.start_time, calendar.timezone).getTime(),
            end: wallTimeToUtc(dateStr, e.end_time, calendar.timezone).getTime(),
          }
        : { start: -Infinity, end: Infinity } // both null = whole day off
    );
  if (closedRanges.length > 0) {
    starts = starts.filter((start) => {
      const end = start + durationMinutes * 60_000;
      return !closedRanges.some((r) => r.start < end && start < r.end);
    });
  }

  const openWindows = dayExceptions
    .filter((e) => e.kind === "open" && e.start_time && e.end_time)
    .map((e) => ({
      start: wallTimeToUtc(dateStr, e.start_time!, calendar.timezone).getTime(),
      end: wallTimeToUtc(dateStr, e.end_time!, calendar.timezone).getTime(),
    }));
  for (const w of openWindows) starts.push(...candidateStarts(w, stepMinutes, durationMinutes));

  return [...new Set(starts)].sort((a, b) => a - b);
}

export type Slot = {
  practitionerId: string;
  practitionerName: string;
  serviceId: ServiceType;
  startsAt: string;
  price: number;
};

// A practitioner has one calendar across all service types: booked time
// ranges (not just exact start-time matches) block slots for every service,
// so an ADHD visit (90min) can't be double-booked by a 50min niskoplatna
// slot that starts partway through it.
export async function listAvailableSlots(serviceType: ServiceType, now = new Date()): Promise<Slot[]> {
  const [{ data, error }, practitioners, calendars, services] = await Promise.all([
    db().from("appointments").select("practitioner_id, starts_at, service_id, status, held_until").neq("status", "cancelled"),
    getPractitioners(),
    getCalendars(),
    getServices(),
  ]);
  if (error) throw error;

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const service = serviceById.get(serviceType);
  if (!service) return [];

  const busy = (data ?? [])
    .filter((a) => !(a.status === "held" && a.held_until && new Date(a.held_until) <= now))
    .map((a) => {
      const start = new Date(a.starts_at).getTime();
      const durationMinutes = serviceById.get(a.service_id as ServiceType)?.durationMinutes ?? 0;
      return { practitionerId: a.practitioner_id as string, start, end: start + durationMinutes * 60_000 };
    });

  const slots: Slot[] = [];
  const eligible = practitioners.filter((p) => p.services.some((s) => s.serviceId === serviceType));
  const stepMinutes = service.durationMinutes + service.bufferMinutes;
  const minStart = new Date(now.getTime() + MIN_LEAD_HOURS * 3_600_000).getTime();

  for (const practitioner of eligible) {
    const calendar = calendars.get(practitioner.id);
    if (!calendar) continue;

    for (let dayOffset = 0; dayOffset <= MAX_SLOT_DAYS_AHEAD; dayOffset++) {
      const dateStr = ymdInTimeZone(new Date(now.getTime() + dayOffset * 86_400_000), calendar.timezone);
      const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      const starts = slotStartsForDay(calendar, serviceType, dateStr, weekday, stepMinutes, service.durationMinutes);

      for (const start of starts) {
        if (start < minStart) continue;
        const end = start + service.durationMinutes * 60_000;
        const overlaps = busy.some((b) => b.practitionerId === practitioner.id && b.start < end && start < b.end);
        if (!overlaps) {
          slots.push({
            practitionerId: practitioner.id,
            practitionerName: practitioner.name,
            serviceId: serviceType,
            startsAt: new Date(start).toISOString(),
            price: priceFor(serviceType, practitioner.id, practitioners, service),
          });
        }
      }
    }
  }
  return slots;
}

// --- Practitioner-facing weekly rhythm editor (/panel/dostepnosc) ---------

// The two service tabs this screen manages. adhd_diagnoza/asystent_zdrowienia/
// bezplatna keep whatever calendar_availability rows they already have —
// no screen edits them yet.
export type ManagedAvailabilityService = "pelnoplatna" | "niskoplatna";

export type WeeklyAvailabilityRange = {
  id: string;
  dayOfWeek: number; // 0=Sunday..6=Saturday, matches the DB check constraint
  startTime: string; // "HH:MM"
  endTime: string;
};

async function getCalendarId(practitionerId: string): Promise<string> {
  const { data, error } = await db()
    .from("calendars")
    .select("id")
    .eq("practitioner_id", practitionerId)
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getWeeklyAvailability(
  practitionerId: string
): Promise<Record<ManagedAvailabilityService, WeeklyAvailabilityRange[]>> {
  const calendarId = await getCalendarId(practitionerId);
  const { data, error } = await db()
    .from("calendar_availability")
    .select("id, service_id, day_of_week, start_time, end_time")
    .eq("calendar_id", calendarId)
    .in("service_id", ["pelnoplatna", "niskoplatna"])
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;

  const result: Record<ManagedAvailabilityService, WeeklyAvailabilityRange[]> = {
    pelnoplatna: [],
    niskoplatna: [],
  };
  for (const row of (data ?? []) as {
    id: string;
    service_id: ManagedAvailabilityService;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }[]) {
    result[row.service_id].push({
      id: row.id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    });
  }
  return result;
}

// Replace-all for one practitioner's one service tab. Not a single DB
// transaction (delete then insert as two calls) — acceptable here since this
// is a low-traffic admin screen with no concurrent writers per calendar.
export async function replaceWeeklyAvailability(
  practitionerId: string,
  serviceId: ManagedAvailabilityService,
  ranges: { dayOfWeek: number; startTime: string; endTime: string }[]
): Promise<void> {
  const calendarId = await getCalendarId(practitionerId);

  const { error: deleteError } = await db()
    .from("calendar_availability")
    .delete()
    .eq("calendar_id", calendarId)
    .eq("service_id", serviceId);
  if (deleteError) throw deleteError;

  if (ranges.length === 0) return;

  const { error: insertError } = await db().from("calendar_availability").insert(
    ranges.map((r) => ({
      calendar_id: calendarId,
      service_id: serviceId,
      day_of_week: r.dayOfWeek,
      start_time: r.startTime,
      end_time: r.endTime,
    }))
  );
  if (insertError) throw insertError;
}

// --- Hour overrides (/panel/dostepnosc, step 2) ---------------------------
// One calendar_exceptions row per toggled hour, exactly the shape
// slotStartsForDay() above already consumes — so the booking side needs no
// change at all. See docs/dostepnosc/02-poprawki-godzinowe.md.
//
// An override is recognised by being scoped to one service and spanning a
// single whole hour. Leave/urlopy (step 3) are service-wide (service_id
// null) and multi-hour, so the two never read each other's rows.

// Local rather than imported from therapist-calendar.ts: that module already
// imports from this one, and a value import would close the cycle.
const WARSAW_TIME_ZONE = "Europe/Warsaw";

export type StoredHourOverride = { date: string; hour: number; kind: "open" | "closed" };

function addDaysUtc(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function getHourOverrides(
  practitionerId: string,
  serviceId: ManagedAvailabilityService,
  fromDate: string,
  days = MAX_SLOT_DAYS_AHEAD
): Promise<StoredHourOverride[]> {
  const calendarId = await getCalendarId(practitionerId);
  const { data, error } = await db()
    .from("calendar_exceptions")
    .select("date, kind, start_time, end_time")
    .eq("calendar_id", calendarId)
    .eq("service_id", serviceId)
    .gte("date", fromDate)
    .lte("date", addDaysUtc(fromDate, days - 1));
  if (error) throw error;

  return ((data ?? []) as { date: string; kind: string; start_time: string | null; end_time: string | null }[])
    .filter((row) => row.start_time !== null && row.end_time !== null)
    .map((row) => ({
      date: row.date,
      hour: Number(row.start_time!.slice(0, 2)),
      kind: row.kind === "open" ? ("open" as const) : ("closed" as const),
    }));
}

/**
 * Booked visits in the grid window, reduced to whole hours. Read straight
 * from appointments — a held-but-unpaid slot still blocks the hour, the same
 * way it blocks a patient's booking.
 */
export type PanelVisit = {
  id: string;
  date: string; // Warsaw YYYY-MM-DD
  startHour: number; // whole-hour grid row the block starts on
  endHour: number; // exclusive — a 90-minute visit spans two rows
  startLabel: string; // "14:00"
  endLabel: string; // "15:30"
  serviceId: ServiceType;
  serviceTitle: string;
  durationMinutes: number;
  status: AppointmentStatus;
  paymentStatus: Appointment["paymentStatus"];
  price: number;
  patient: { name: string; email: string; phone: string };
};

/**
 * Booked visits inside the grid window, each already reduced to the whole
 * hours it covers so the grid can render one merged block instead of N
 * identical cells — a 90-minute ADHD diagnosis genuinely occupies two rows.
 */
export async function getBookedVisits(
  practitionerId: string,
  fromDate: string,
  days = MAX_SLOT_DAYS_AHEAD,
  now = new Date()
): Promise<PanelVisit[]> {
  const from = wallTimeToUtc(fromDate, "00:00", WARSAW_TIME_ZONE).getTime();
  const to = wallTimeToUtc(addDaysUtc(fromDate, days), "00:00", WARSAW_TIME_ZONE).getTime();
  const appointments = await getAppointmentsForPractitioner(practitionerId, now);

  const pad = (value: number) => String(value).padStart(2, "0");

  return appointments
    .filter((appointment) => {
      const startsAt = new Date(appointment.startsAt).getTime();
      return startsAt >= from && startsAt < to;
    })
    .map((appointment) => {
      const startsAt = new Date(appointment.startsAt);
      const [hour, minute] = new Intl.DateTimeFormat("en-GB", {
        timeZone: WARSAW_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(startsAt)
        .split(":")
        .map(Number);
      const startMinutes = hour * 60 + minute;
      const endMinutes = startMinutes + appointment.service.durationMinutes;
      return {
        id: appointment.id,
        date: ymdInTimeZone(startsAt, WARSAW_TIME_ZONE),
        startHour: hour,
        endHour: Math.ceil(endMinutes / 60),
        startLabel: `${pad(hour)}:${pad(minute)}`,
        endLabel: `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`,
        serviceId: appointment.serviceId,
        serviceTitle: appointment.service.title,
        durationMinutes: appointment.service.durationMinutes,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        price: appointment.price,
        patient: appointment.patient,
      };
    });
}

/**
 * Insert or delete the single exception row behind one grid cell. `clear`
 * deletes it so the hour falls back to whatever the weekly rhythm says,
 * which is why the delete is keyed on the slot rather than on a row id the
 * browser would otherwise have to carry.
 */
export async function toggleHourOverride(input: {
  practitionerId: string;
  serviceId: ManagedAvailabilityService;
  date: string;
  hour: number;
  intent: "open" | "closed" | "clear";
}): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Niepoprawna data.");
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("Niepoprawna godzina.");
  }
  const calendarId = await getCalendarId(input.practitionerId);
  const startTime = `${String(input.hour).padStart(2, "0")}:00`;

  const { error: deleteError } = await db()
    .from("calendar_exceptions")
    .delete()
    .eq("calendar_id", calendarId)
    .eq("service_id", input.serviceId)
    .eq("date", input.date)
    .eq("start_time", startTime);
  if (deleteError) throw deleteError;

  if (input.intent === "clear") return;

  const { error } = await db().from("calendar_exceptions").insert({
    calendar_id: calendarId,
    service_id: input.serviceId,
    date: input.date,
    kind: input.intent,
    start_time: startTime,
    end_time: `${String(input.hour + 1).padStart(2, "0")}:00`,
  });
  if (error) throw error;
}

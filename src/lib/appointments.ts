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
};

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
  };
}

function appointmentEndsAt(appt: Appointment): number {
  return new Date(appt.startsAt).getTime() + appt.service.durationMinutes * 60_000;
}

// Whether a session has started — the earliest point a specialist can
// meaningfully mark it completed/no_show (they may know at the start that a
// patient hasn't joined, no need to wait for the full duration to elapse).
export function isPastAppointment(appt: Appointment, now = new Date()): boolean {
  return new Date(appt.startsAt).getTime() <= now.getTime();
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

  // ADHD diagnoza is the longest, highest-stakes session in this slice —
  // send an SMS reminder on top of the confirmation screen. No SMS provider
  // is wired up yet, so this is a stub (src/lib/sms.ts) same as OTP was.
  if (confirmed.serviceId === "adhd_diagnoza") {
    const practitioner = await getPractitioner(confirmed.practitionerId);
    sendSms(confirmed.patient.phone, buildConfirmationSmsText(confirmed.startsAt, practitioner?.meetingInfo ?? null));
  }

  return confirmed;
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
    .select(APPOINTMENT_SELECT)
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
    .select(APPOINTMENT_SELECT)
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

// Explicit outcome for a past session — the counterpart to the automatic
// completion in expireIfStale(). "no_show" can only be set this way: the
// system has no signal that a patient didn't attend beyond a specialist
// saying so.
export async function markAttendance(
  id: string,
  outcome: Extract<AppointmentStatus, "completed" | "no_show">,
  now = new Date()
): Promise<Appointment> {
  const appt = await getAppointment(id, now);
  if (!appt) throw new Error("appointment not found");
  if (appt.status !== "confirmed") throw new Error("only a confirmed appointment can be marked");
  if (!isPastAppointment(appt, now)) throw new Error("appointment hasn't started yet");
  const { data, error } = await db()
    .from("appointments")
    .update({ status: outcome })
    .eq("id", id)
    .eq("status", "confirmed")
    .select(APPOINTMENT_SELECT)
    .single();
  if (error) throw error;
  return fromRow(data as Row);
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
  practitioner_services: { service_id: ServiceType; price_override: number | null }[];
};

function fromPractitionerRow(r: PractitionerRow): Practitioner {
  return {
    id: r.id,
    name: r.name,
    meetingInfo: r.meeting_info,
    services: (r.practitioner_services ?? []).map((ps) => ({ serviceId: ps.service_id, priceOverride: ps.price_override })),
  };
}

export async function getPractitioners(): Promise<Practitioner[]> {
  const { data, error } = await db()
    .from("practitioners")
    .select("id, name, meeting_info, practitioner_services(service_id, price_override)");
  if (error) throw error;
  return ((data ?? []) as PractitionerRow[]).map(fromPractitionerRow);
}

export async function getPractitioner(id: string): Promise<Practitioner | undefined> {
  const { data, error } = await db()
    .from("practitioners")
    .select("id, name, meeting_info, practitioner_services(service_id, price_override)")
    .eq("id", id)
    .maybeSingle();
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

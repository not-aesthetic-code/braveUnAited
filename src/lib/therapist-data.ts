import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getAppointmentsForPractitioner,
  getPractitioner,
  type Appointment,
  type ServiceType,
} from "./appointments";
import {
  validateAvailabilityException,
  validateWeeklyAvailability,
  warsawWallTimeToIso,
  type AvailabilityExceptionInput,
  type CommunityServiceType,
  type HourCorrection,
  type WeeklyAvailabilityInput,
} from "./therapist-calendar";

export const DEMO_PRACTITIONER_ID = "spec-1";

export type StoredAvailability = WeeklyAvailabilityInput & { id: string };
export type StoredException = AvailabilityExceptionInput & { id: string };

export type TherapistPanelData = {
  practitioner: { id: string; name: string; meetingInfo: string | null };
  appointments: Appointment[];
  availability: StoredAvailability[];
  /** Multi-hour holidays and time off — the "Wolne i urlopy" table. */
  absences: StoredException[];
  /** Single-hour edits on top of the weekly rhythm — the hour grid. */
  corrections: HourCorrection[];
};

let admin: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Brakuje konfiguracji Supabase dla panelu terapeuty.");
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}

const communityType = (value: string | null): value is CommunityServiceType =>
  value === "niskoplatna" || value === "bezplatna";

type ExceptionRow = {
  id: string;
  service_id: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  kind: string;
  source: string;
};

export async function getTherapistPanelData(): Promise<TherapistPanelData> {
  const [practitioner, appointments, calendarResult] = await Promise.all([
    getPractitioner(DEMO_PRACTITIONER_ID),
    getAppointmentsForPractitioner(DEMO_PRACTITIONER_ID),
    db()
      .from("calendars")
      .select(
        "id, calendar_availability(id, service_id, day_of_week, start_time, end_time), calendar_exceptions(id, service_id, date, start_time, end_time, reason, kind, source)",
      )
      .eq("practitioner_id", DEMO_PRACTITIONER_ID)
      .single(),
  ]);
  if (!practitioner) throw new Error("Nie znaleziono przykładowego terapeuty.");
  if (calendarResult.error) throw calendarResult.error;

  const calendar = calendarResult.data as {
    calendar_availability: Array<{
      id: string;
      service_id: string | null;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
    calendar_exceptions: ExceptionRow[];
  };

  const availability = calendar.calendar_availability
    .filter((row) => communityType(row.service_id))
    .map((row) => ({
      id: row.id,
      weekday: row.day_of_week === 0 ? 7 : row.day_of_week,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
      serviceType: row.service_id as CommunityServiceType,
    }));

  const absences = calendar.calendar_exceptions
    .filter((row) => row.source !== "correction" && row.kind === "closed" && row.start_time && row.end_time)
    .map((row) => ({
      id: row.id,
      date: row.date,
      startTime: row.start_time!.slice(0, 5),
      endTime: row.end_time!.slice(0, 5),
      reason: row.reason ?? "",
    }));

  const corrections = calendar.calendar_exceptions
    .filter((row) => row.source === "correction" && row.start_time && communityType(row.service_id))
    .map((row) => ({
      id: row.id,
      date: row.date,
      startTime: row.start_time!.slice(0, 5),
      kind: row.kind === "open" ? ("open" as const) : ("closed" as const),
      serviceType: row.service_id as CommunityServiceType,
    }));

  return {
    practitioner: { id: practitioner.id, name: practitioner.name, meetingInfo: practitioner.meetingInfo },
    appointments: appointments.filter((appointment) => appointment.status !== "cancelled"),
    availability,
    absences,
    corrections,
  };
}

async function calendarId(): Promise<string> {
  const { data, error } = await db()
    .from("calendars")
    .select("id")
    .eq("practitioner_id", DEMO_PRACTITIONER_ID)
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function replaceWeeklyAvailability(ranges: WeeklyAvailabilityInput[]) {
  const validation = validateWeeklyAvailability(ranges);
  if (!validation.ok) throw new Error(validation.error);
  const payload = ranges.map((range) => ({
    day_of_week: range.weekday === 7 ? 0 : range.weekday,
    start_time: range.startTime,
    end_time: range.endTime,
    service_id: range.serviceType,
  }));
  const { error } = await db().rpc("replace_community_availability", {
    p_practitioner_id: DEMO_PRACTITIONER_ID,
    p_ranges: payload,
  });
  if (error) throw error;
  return { minutes: validation.minutes };
}

export async function addAvailabilityException(input: AvailabilityExceptionInput) {
  const panel = await getTherapistPanelData();
  const validation = validateAvailabilityException(input, panel.absences);
  if (!validation.ok) throw new Error(validation.error);

  const { error } = await db().from("calendar_exceptions").insert({
    calendar_id: await calendarId(),
    service_id: null,
    date: input.date,
    kind: "closed",
    source: "absence",
    start_time: input.startTime,
    end_time: input.endTime,
    reason: input.reason?.trim() || null,
  });
  if (error) throw error;

  return { conflicts: conflictingPatients(panel.appointments, input) };
}

/**
 * A holiday never cancels anything on its own, so the caller has to be able
 * to tell the therapist which visits now sit inside blocked time.
 */
function conflictingPatients(appointments: Appointment[], input: AvailabilityExceptionInput): string[] {
  const startsAt = new Date(warsawWallTimeToIso(input.date, input.startTime)).getTime();
  const endsAt = new Date(warsawWallTimeToIso(input.date, input.endTime)).getTime();
  return appointments
    .filter((appointment) => {
      const start = new Date(appointment.startsAt).getTime();
      return start < endsAt && startsAt < start + appointment.service.durationMinutes * 60_000;
    })
    .map((appointment) => appointment.patient.name);
}

export type CorrectionIntent = "open" | "closed" | "clear";

/**
 * One cell of the hour grid. `clear` drops the correction so the hour falls
 * back to whatever the weekly rhythm says, which is why the delete is keyed
 * on the slot rather than on a row id the browser would have to hold.
 */
export async function setHourCorrection(input: {
  date: string;
  hour: number;
  serviceType: CommunityServiceType;
  intent: CorrectionIntent;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Wybierz poprawną datę.");
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("Niepoprawna godzina.");
  }
  const startTime = `${String(input.hour).padStart(2, "0")}:00`;
  const endTime = `${String(input.hour + 1).padStart(2, "0")}:00`;
  const id = await calendarId();

  const { error: deleteError } = await db()
    .from("calendar_exceptions")
    .delete()
    .eq("calendar_id", id)
    .eq("source", "correction")
    .eq("service_id", input.serviceType)
    .eq("date", input.date)
    .eq("start_time", startTime);
  if (deleteError) throw deleteError;

  if (input.intent === "clear") return { kind: null };

  const { error } = await db().from("calendar_exceptions").insert({
    calendar_id: id,
    service_id: input.serviceType,
    date: input.date,
    kind: input.intent,
    source: "correction",
    start_time: startTime,
    end_time: endTime,
  });
  if (error) throw error;
  return { kind: input.intent };
}

export function serviceTone(serviceId: ServiceType) {
  return serviceId === "niskoplatna"
    ? "community"
    : serviceId === "bezplatna"
      ? "free"
      : serviceId === "pelnoplatna"
        ? "paid"
        : "diagnostic";
}

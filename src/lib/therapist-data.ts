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
  type WeeklyAvailabilityInput,
} from "./therapist-calendar";

export const DEMO_PRACTITIONER_ID = "spec-1";

export type StoredAvailability = WeeklyAvailabilityInput & { id: string };
export type StoredException = AvailabilityExceptionInput & { id: string };

export type TherapistPanelData = {
  practitioner: { id: string; name: string; meetingInfo: string | null };
  appointments: Appointment[];
  availability: StoredAvailability[];
  exceptions: StoredException[];
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

const communityType = (value: string | null): value is "niskoplatna" | "bezplatna" =>
  value === "niskoplatna" || value === "bezplatna";

export async function getTherapistPanelData(): Promise<TherapistPanelData> {
  const [practitioner, appointments, calendarResult] = await Promise.all([
    getPractitioner(DEMO_PRACTITIONER_ID),
    getAppointmentsForPractitioner(DEMO_PRACTITIONER_ID),
    db()
      .from("calendars")
      .select(
        "id, calendar_availability(id, service_id, day_of_week, start_time, end_time), calendar_exceptions(id, date, start_time, end_time, reason, kind)",
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
    calendar_exceptions: Array<{
      id: string;
      date: string;
      start_time: string | null;
      end_time: string | null;
      reason: string | null;
      kind: string;
    }>;
  };

  const availability = calendar.calendar_availability
    .filter((row) => communityType(row.service_id))
    .map((row) => ({
      id: row.id,
      weekday: row.day_of_week === 0 ? 7 : row.day_of_week,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
      serviceType: row.service_id as "niskoplatna" | "bezplatna",
    }));
  const exceptions = calendar.calendar_exceptions
    .filter((row) => row.kind === "closed" && row.start_time && row.end_time)
    .map((row) => ({
      id: row.id,
      date: row.date,
      startTime: row.start_time!.slice(0, 5),
      endTime: row.end_time!.slice(0, 5),
      reason: row.reason ?? "",
    }));

  return {
    practitioner: { id: practitioner.id, name: practitioner.name, meetingInfo: practitioner.meetingInfo },
    appointments: appointments.filter((appointment) => appointment.status !== "cancelled"),
    availability,
    exceptions,
  };
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
  const validation = validateAvailabilityException(input, panel.exceptions);
  if (!validation.ok) throw new Error(validation.error);

  const { data: calendar, error: calendarError } = await db()
    .from("calendars")
    .select("id")
    .eq("practitioner_id", DEMO_PRACTITIONER_ID)
    .single();
  if (calendarError) throw calendarError;

  const { error } = await db().from("calendar_exceptions").insert({
    calendar_id: calendar.id,
    service_id: null,
    date: input.date,
    kind: "closed",
    start_time: input.startTime,
    end_time: input.endTime,
    reason: input.reason?.trim() || null,
  });
  if (error) throw error;

  const startsAt = new Date(warsawWallTimeToIso(input.date, input.startTime)).getTime();
  const endsAt = new Date(warsawWallTimeToIso(input.date, input.endTime)).getTime();
  const conflicts = panel.appointments.filter((appointment) => {
    const start = new Date(appointment.startsAt).getTime();
    const duration = appointment.service.durationMinutes * 60_000;
    return start < endsAt && startsAt < start + duration;
  });
  return { conflicts: conflicts.map((appointment) => appointment.patient.name) };
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

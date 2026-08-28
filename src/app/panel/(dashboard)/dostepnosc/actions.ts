"use server";

import { revalidatePath } from "next/cache";
import { getPractitionerSession } from "@/lib/panel-auth";
import {
  getEnabledServiceIds,
  getService,
  replaceWeeklyAvailability,
  type ServiceType,
} from "@/lib/appointments";
import { validateWeeklyRanges } from "@/lib/therapist-calendar";

export type RangeInput = { dayOfWeek: number; startTime: string; endTime: string };

// Partial: only the services present get written. A tab the practitioner
// never opened this session must not have its hours wiped just because it's
// absent from the payload.
export type SaveWeeklyAvailabilityInput = Partial<Record<ServiceType, RangeInput[]>>;

export type SaveWeeklyAvailabilityResult = { ok: true } | { ok: false; error: string };

// therapist-calendar.ts uses 1=Monday..7=Sunday; the DB (and everything else
// in this module) uses 0=Sunday..6=Saturday.
function toIsoWeekday(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

export async function saveWeeklyAvailabilityAction(
  input: SaveWeeklyAvailabilityInput
): Promise<SaveWeeklyAvailabilityResult> {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) return { ok: false, error: "Sesja wygasła — zaloguj się ponownie." };

  // Re-derived here rather than trusted from the client — a posted key for a
  // service the practitioner isn't (or is no longer) enabled for must not
  // reach replaceWeeklyAvailability.
  const enabled = await getEnabledServiceIds(practitionerId);
  const entries = Object.entries(input) as [ServiceType, RangeInput[]][];

  for (const [serviceId] of entries) {
    if (!enabled.includes(serviceId)) return { ok: false, error: "Nieznana usługa." };
  }

  for (const [serviceId, ranges] of entries) {
    const result = validateWeeklyRanges(
      ranges.map((r) => ({ weekday: toIsoWeekday(r.dayOfWeek), startTime: r.startTime, endTime: r.endTime }))
    );
    if (!result.ok) {
      const service = await getService(serviceId);
      return { ok: false, error: `${service?.title ?? serviceId}: ${result.error}` };
    }
  }

  await Promise.all(entries.map(([serviceId, ranges]) => replaceWeeklyAvailability(practitionerId, serviceId, ranges)));

  // Without this the hour grid on the same page keeps rendering the
  // availability the server read before the save, so a newly opened 06:00
  // never shows up until a hard reload.
  revalidatePath("/panel/dostepnosc");

  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getPractitionerSession } from "@/lib/panel-auth";
import { replaceWeeklyAvailability, type ManagedAvailabilityService } from "@/lib/appointments";
import { validateWeeklyRanges } from "@/lib/therapist-calendar";

export type RangeInput = { dayOfWeek: number; startTime: string; endTime: string };

export type SaveWeeklyAvailabilityInput = Record<ManagedAvailabilityService, RangeInput[]>;

export type SaveWeeklyAvailabilityResult = { ok: true } | { ok: false; error: string };

const SERVICE_LABEL: Record<ManagedAvailabilityService, string> = {
  pelnoplatna: "Konsultacje pełnopłatne",
  niskoplatna: "Konsultacje niskopłatne",
};

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

  for (const serviceId of ["pelnoplatna", "niskoplatna"] as const) {
    const result = validateWeeklyRanges(
      input[serviceId].map((r) => ({
        weekday: toIsoWeekday(r.dayOfWeek),
        startTime: r.startTime,
        endTime: r.endTime,
      }))
    );
    if (!result.ok) return { ok: false, error: `${SERVICE_LABEL[serviceId]}: ${result.error}` };
  }

  await Promise.all(
    (["pelnoplatna", "niskoplatna"] as const).map((serviceId) =>
      replaceWeeklyAvailability(practitionerId, serviceId, input[serviceId])
    )
  );

  // Without this the hour grid on the same page keeps rendering the
  // availability the server read before the save, so a newly opened 06:00
  // never shows up until a hard reload.
  revalidatePath("/panel/dostepnosc");

  return { ok: true };
}

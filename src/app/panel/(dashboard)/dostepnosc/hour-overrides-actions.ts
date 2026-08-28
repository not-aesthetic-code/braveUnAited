"use server";

import { revalidatePath } from "next/cache";
import { toggleHourOverride, type ManagedAvailabilityService } from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";

export type ToggleHourResult = { ok: true } | { ok: false; error: string };

// Trust boundary, same as the other panel actions: the practitioner comes
// from the session, never from the browser, so a posted payload can only
// ever edit the caller's own calendar.
export async function toggleHourOverrideAction(input: {
  serviceId: ManagedAvailabilityService;
  date: string;
  hour: number;
  intent: "open" | "closed" | "clear";
}): Promise<ToggleHourResult> {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) return { ok: false, error: "Sesja wygasła — zaloguj się ponownie." };

  if (input.serviceId !== "pelnoplatna" && input.serviceId !== "niskoplatna") {
    return { ok: false, error: "Nieznana usługa." };
  }

  try {
    await toggleHourOverride({ practitionerId, ...input });
    revalidatePath("/panel/dostepnosc");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Nie udało się zapisać poprawki." };
  }
}

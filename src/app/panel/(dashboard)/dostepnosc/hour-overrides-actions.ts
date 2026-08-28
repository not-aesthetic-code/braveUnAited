"use server";

import { revalidatePath } from "next/cache";
import {
  getBookedVisits,
  getHourOverrides,
  toggleHourOverride,
  type ManagedAvailabilityService,
  type PanelVisit,
  type StoredHourOverride,
} from "@/lib/appointments";
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

export type HourGridWeek = {
  fromDate: string;
  overrides: Record<ManagedAvailabilityService, StoredHourOverride[]>;
  visits: PanelVisit[];
};

export type LoadWeekResult = { ok: true; week: HourGridWeek } | { ok: false; error: string };

/**
 * One week of grid data, for stepping the correction grid forwards or back.
 * Loaded on demand rather than shipping months of rows to the browser up
 * front — a practitioner looks at one week at a time.
 *
 * Both managed services come back together: the cross-service warning has to
 * judge the same week it is warning about, not the one the page happened to
 * render on load.
 */
export async function loadHourGridWeekAction(fromDate: string): Promise<LoadWeekResult> {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) return { ok: false, error: "Sesja wygasła — zaloguj się ponownie." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return { ok: false, error: "Niepoprawna data." };

  try {
    const [pelnoplatna, niskoplatna, visits] = await Promise.all([
      getHourOverrides(practitionerId, "pelnoplatna", fromDate),
      getHourOverrides(practitionerId, "niskoplatna", fromDate),
      getBookedVisits(practitionerId, fromDate),
    ]);
    return { ok: true, week: { fromDate, overrides: { pelnoplatna, niskoplatna }, visits } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Nie udało się wczytać tygodnia." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import {
  addAvailabilityException,
  replaceWeeklyAvailability,
  setHourCorrection,
  type CorrectionIntent,
} from "@/lib/therapist-data";
import type {
  AvailabilityExceptionInput,
  CommunityServiceType,
  WeeklyAvailabilityInput,
} from "@/lib/therapist-calendar";

export type PanelActionResult = {
  ok: boolean;
  message: string;
  conflicts?: string[];
};

// Both panel routes read the same calendar, so every mutation has to
// invalidate both — otherwise the grid and the week view disagree.
function revalidatePanel() {
  revalidatePath("/panel");
  revalidatePath("/panel/dostepnosc");
}

export async function saveAvailabilityAction(
  ranges: WeeklyAvailabilityInput[],
): Promise<PanelActionResult> {
  try {
    const result = await replaceWeeklyAvailability(ranges);
    revalidatePanel();
    return { ok: true, message: `Grafik zapisany · ${Math.floor(result.minutes / 60)} h ${result.minutes % 60} min.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Nie udało się zapisać grafiku." };
  }
}

export async function createAbsenceAction(
  input: AvailabilityExceptionInput,
): Promise<PanelActionResult> {
  try {
    const result = await addAvailabilityException(input);
    revalidatePanel();
    return {
      ok: true,
      message: result.conflicts.length
        ? "Nieobecność zapisana. Istniejące wizyty wymagają osobnej decyzji."
        : "Nieobecność zapisana.",
      conflicts: result.conflicts,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Nie udało się zapisać nieobecności." };
  }
}

export async function toggleHourCorrectionAction(input: {
  date: string;
  hour: number;
  serviceType: CommunityServiceType;
  intent: CorrectionIntent;
}): Promise<PanelActionResult> {
  try {
    await setHourCorrection(input);
    revalidatePanel();
    return { ok: true, message: "Poprawka zapisana." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Nie udało się zapisać poprawki." };
  }
}

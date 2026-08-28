"use server";

import { revalidatePath } from "next/cache";
import {
  addAvailabilityException,
  replaceWeeklyAvailability,
} from "@/lib/therapist-data";
import type {
  AvailabilityExceptionInput,
  WeeklyAvailabilityInput,
} from "@/lib/therapist-calendar";

export type PanelActionResult = {
  ok: boolean;
  message: string;
  conflicts?: string[];
};

export async function saveAvailabilityAction(
  ranges: WeeklyAvailabilityInput[],
): Promise<PanelActionResult> {
  try {
    const result = await replaceWeeklyAvailability(ranges);
    revalidatePath("/panel");
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
    revalidatePath("/panel");
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

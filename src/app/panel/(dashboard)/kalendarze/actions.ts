"use server";

import { revalidatePath } from "next/cache";
import { getPractitionerSession } from "@/lib/panel-auth";
import {
  PELNOPLATNA_RATE_OPTIONS,
  setPelnoplatnaRate,
  setServiceAccepting,
  type PelnoplatnaRate,
  type ServiceType,
} from "@/lib/appointments";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setServiceAcceptingAction(
  serviceId: ServiceType,
  isAccepting: boolean
): Promise<ActionResult> {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) return { ok: false, error: "Sesja wygasła — zaloguj się ponownie." };

  try {
    await setServiceAccepting(practitionerId, serviceId, isAccepting);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nie udało się zapisać zmiany." };
  }

  revalidatePath("/panel/kalendarze");
  return { ok: true };
}

export async function setPelnoplatnaRateAction(rate: number): Promise<ActionResult> {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) return { ok: false, error: "Sesja wygasła — zaloguj się ponownie." };

  if (!(PELNOPLATNA_RATE_OPTIONS as readonly number[]).includes(rate)) {
    return { ok: false, error: "Wybierz jedną z dostępnych stawek." };
  }

  await setPelnoplatnaRate(practitionerId, rate as PelnoplatnaRate);
  revalidatePath("/panel/kalendarze");
  return { ok: true };
}

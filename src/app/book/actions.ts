"use server";

import {
  confirmPayment,
  holdSlot,
  type PatientContact,
  type ServiceType,
} from "@/lib/appointments";

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

function toError(e: unknown): string {
  return e instanceof Error ? e.message : "Coś poszło nie tak — spróbuj ponownie";
}

export async function holdSlotAction(input: {
  specialistId: string;
  serviceType: ServiceType;
  startsAt: string;
  patientContact: PatientContact;
}): Promise<ActionResult<ReturnType<typeof holdSlot>>> {
  try {
    return { ok: true, value: holdSlot(input) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function confirmPaymentAction(
  id: string
): Promise<ActionResult<ReturnType<typeof confirmPayment>>> {
  try {
    return { ok: true, value: confirmPayment(id) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

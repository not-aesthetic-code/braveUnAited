"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelAppointment, CANCEL_REASONS, rescheduleAppointment, type CancelReason } from "@/lib/appointments";
import { startPaymentAction } from "@/app/book/actions";

export async function payBookingAction(id: string) {
  const result = await startPaymentAction(id);
  if (!result.ok) throw new Error(result.error);
  redirect(result.value.url);
}

function isCancelReason(value: FormDataEntryValue | null): value is CancelReason {
  return typeof value === "string" && CANCEL_REASONS.some((r) => r.value === value);
}

export async function cancelBookingAction(id: string, formData: FormData) {
  const reason = formData.get("reason");
  await cancelAppointment(id, isCancelReason(reason) ? reason : null);
  revalidatePath(`/my-booking/${id}`);
}

export async function rescheduleBookingAction(id: string, formData: FormData) {
  const newStartsAt = formData.get("newStartsAt");
  if (typeof newStartsAt !== "string" || !newStartsAt) return;
  await rescheduleAppointment(id, newStartsAt);
  revalidatePath(`/my-booking/${id}`);
}

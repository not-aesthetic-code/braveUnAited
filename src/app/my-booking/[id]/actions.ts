"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelAppointment, rescheduleAppointment } from "@/lib/appointments";
import { startPaymentAction } from "@/app/book/actions";

export async function payBookingAction(id: string) {
  const result = await startPaymentAction(id);
  if (!result.ok) throw new Error(result.error);
  redirect(result.value.url);
}

export async function cancelBookingAction(id: string, _formData: FormData) {
  await cancelAppointment(id);
  revalidatePath(`/my-booking/${id}`);
}

export async function rescheduleBookingAction(id: string, formData: FormData) {
  const newStartsAt = formData.get("newStartsAt");
  if (typeof newStartsAt !== "string" || !newStartsAt) return;
  await rescheduleAppointment(id, newStartsAt);
  revalidatePath(`/my-booking/${id}`);
}

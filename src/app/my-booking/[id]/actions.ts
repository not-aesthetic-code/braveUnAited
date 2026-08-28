"use server";

import { revalidatePath } from "next/cache";
import { cancelAppointment, rescheduleAppointment } from "@/lib/appointments";

export async function cancelBookingAction(id: string, _formData: FormData) {
  cancelAppointment(id);
  revalidatePath(`/my-booking/${id}`);
}

export async function rescheduleBookingAction(id: string, formData: FormData) {
  const newStartsAt = formData.get("newStartsAt");
  if (typeof newStartsAt !== "string" || !newStartsAt) return;
  rescheduleAppointment(id, newStartsAt);
  revalidatePath(`/my-booking/${id}`);
}

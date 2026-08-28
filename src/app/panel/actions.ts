"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cancelAppointmentAsPractitioner,
  getPatientsToRemind,
  markNoShow,
  rescheduleAppointmentAsPractitioner,
  sendVisitReminderEmail,
} from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/panel/login");
}

// Same auth-metadata key panel/page.tsx reads — see the comment there for
// why it's still `specialist_id` after the DB rename to `practitioners`.
async function requirePractitionerId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const practitionerId = data?.claims?.app_metadata?.specialist_id as string | undefined;
  if (!practitionerId) redirect("/panel/login");
  return practitionerId;
}

export async function cancelPractitionerBookingAction(id: string, _formData: FormData) {
  const practitionerId = await requirePractitionerId();
  await cancelAppointmentAsPractitioner(id, practitionerId);
  revalidatePath("/panel");
}

export async function reschedulePractitionerBookingAction(id: string, formData: FormData) {
  const newStartsAt = formData.get("newStartsAt");
  if (typeof newStartsAt !== "string" || !newStartsAt) return;
  const practitionerId = await requirePractitionerId();
  await rescheduleAppointmentAsPractitioner(id, practitionerId, newStartsAt);
  revalidatePath("/panel");
}

export async function markNoShowAction(id: string, formData: FormData) {
  const practitionerId = await requirePractitionerId();
  await markNoShow(id, practitionerId, formData.get("fullRefund") === "on");
  revalidatePath("/panel");
}

// Same trust boundary as markNoShowAction: re-derive this practitioner's own
// reminder list rather than trusting the posted patientId outright, otherwise
// a logged-in doctor could email an arbitrary patient id.
export async function sendReminderEmailAction(patientId: string) {
  const practitionerId = await requirePractitionerId();
  const candidates = await getPatientsToRemind(practitionerId);
  if (!candidates.some((c) => c.patient.id === patientId)) throw new Error("not a reminder candidate for this practitioner");
  await sendVisitReminderEmail(patientId);
  revalidatePath("/panel");
}

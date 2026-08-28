"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppointment, getPatientsToRemind, markAttendance, sendVisitReminderEmail, type AppointmentStatus } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/panel/login");
}

async function requirePractitionerId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const practitionerId = data?.claims?.app_metadata?.specialist_id as string | undefined;
  if (!practitionerId) redirect("/panel/login");
  return practitionerId;
}

// Trust boundary: the id alone isn't proof of ownership, so this loads the
// appointment and checks it belongs to whoever is logged in before touching
// it — the panel UI only ever renders buttons for one's own appointments,
// but a patient's booking link (/my-booking/[id]) is also just an id, and
// nothing stops a logged-in doctor from POSTing someone else's.
export async function markAttendanceAction(id: string, outcome: Extract<AppointmentStatus, "completed" | "no_show">) {
  const practitionerId = await requirePractitionerId();
  const appt = await getAppointment(id);
  if (!appt || appt.practitionerId !== practitionerId) throw new Error("not your appointment");
  await markAttendance(id, outcome);
  revalidatePath("/panel");
}

// Same trust boundary as markAttendanceAction: re-derive this practitioner's
// own reminder list rather than trusting the posted patientId outright,
// otherwise a logged-in doctor could email an arbitrary patient id.
export async function sendReminderEmailAction(patientId: string) {
  const practitionerId = await requirePractitionerId();
  const candidates = await getPatientsToRemind(practitionerId);
  if (!candidates.some((c) => c.patient.id === patientId)) throw new Error("not a reminder candidate for this practitioner");
  await sendVisitReminderEmail(patientId);
  revalidatePath("/panel");
}

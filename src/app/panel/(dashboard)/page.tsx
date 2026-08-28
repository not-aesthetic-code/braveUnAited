import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getAppointmentsForPractitioner, getPatientsToRemind, REMINDER_AFTER_WEEKS } from "@/lib/appointments";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  held: "Oczekuje na płatność",
  confirmed: "Potwierdzona",
  cancelled: "Odwołana",
  completed: "Odbyta",
  no_show: "Nieobecność",
};

export default async function DoctorPanelPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // The auth metadata key stays `specialist_id` even after the DB rename to
  // `practitioners` — it's already provisioned on live Supabase Auth users
  // (scripts/seed-doctors.ts), and renaming it would log every doctor out
  // until the seed script reran.
  const practitionerId = claims?.app_metadata?.specialist_id as string | undefined;

  if (!claims || !practitionerId) redirect("/panel/login");

  const [appointments, reminders] = await Promise.all([
    getAppointmentsForPractitioner(practitionerId),
    getPatientsToRemind(practitionerId),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel specjalisty</h1>
          <p className="text-sm text-muted-foreground">{claims.email as string}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">Wyloguj</Button>
        </form>
      </div>

      {reminders.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Warto przypomnieć o wizycie ({REMINDER_AFTER_WEEKS}+ tyg. bez kontaktu)
          </h2>
          {reminders.map((r) => (
            <div key={r.patient.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.patient.name}</p>
                <p className="text-sm text-muted-foreground">{r.patient.phone}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Ostatnia wizyta:{" "}
                {new Date(r.lastVisitAt).toLocaleDateString("pl-PL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold tracking-tight">Twoje wizyty</h2>

      {appointments.length === 0 && (
        <p className="text-muted-foreground">Brak zaplanowanych wizyt.</p>
      )}

      <div className="flex flex-col gap-3">
        {appointments.map((appt) => (
          <div key={appt.id} className="rounded-xl border bg-card p-5">
            <p className="font-medium">{appt.service.title}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(appt.startsAt).toLocaleString("pl-PL", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <span>Status: <span className="font-medium">{STATUS_LABEL[appt.status]}</span></span>
              <span>Pacjent: <span className="font-medium">{appt.patient.name}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

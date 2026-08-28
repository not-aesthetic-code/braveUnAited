import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getAppointmentsForPractitioner, getPatientsToRemind, isPastAppointment, REMINDER_AFTER_WEEKS } from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import { markAttendanceAction, sendReminderEmailAction } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  held: "Oczekuje na płatność",
  confirmed: "Potwierdzona",
  cancelled: "Odwołana",
  completed: "Odbyta",
  no_show: "Nieobecność",
};

export default async function DoctorPanelPage() {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) redirect("/panel/login");

  const [appointments, reminders] = await Promise.all([
    getAppointmentsForPractitioner(practitionerId),
    getPatientsToRemind(practitionerId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Panel specjalisty</p>
        <h1 className="text-2xl font-bold tracking-tight">Wizyty</h1>
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
              <div className="mt-3 flex items-center gap-3">
                {r.patient.email ? (
                  <form action={sendReminderEmailAction.bind(null, r.patient.id)}>
                    <Button type="submit" variant="outline" size="sm">Wyślij przypomnienie e-mailem</Button>
                  </form>
                ) : (
                  <span className="text-sm text-muted-foreground">Brak e-maila — zadzwoń</span>
                )}
                {r.lastReminderSentAt && (
                  <span className="text-xs text-muted-foreground">
                    Ostatnio wysłano{" "}
                    {new Date(r.lastReminderSentAt).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}
                  </span>
                )}
              </div>
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
            {appt.status === "confirmed" && isPastAppointment(appt) && (
              <div className="mt-3 flex gap-2">
                <form action={markAttendanceAction.bind(null, appt.id, "completed")}>
                  <Button type="submit" variant="outline" size="sm">Wizyta się odbyła</Button>
                </form>
                <form action={markAttendanceAction.bind(null, appt.id, "no_show")}>
                  <Button type="submit" variant="outline" size="sm">Pacjent się nie zjawił</Button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

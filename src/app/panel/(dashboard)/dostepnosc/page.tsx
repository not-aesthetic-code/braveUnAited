import { redirect } from "next/navigation";
import { getAppointmentsForPractitioner, getService, getWeeklyAvailability } from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import { startOfWarsawWeek } from "@/lib/therapist-calendar";
import { WeeklyRhythmEditor } from "./weekly-rhythm-editor";

// Foundation rule: a specialist can take on at most this many low-cost
// visits per week — the pool resets every Monday (Warsaw time).
export const LOW_COST_WEEKLY_VISIT_LIMIT = 5;

export default async function DostepnoscPage() {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) redirect("/panel/login");

  const [availability, pelnoplatna, niskoplatna, appointments] = await Promise.all([
    getWeeklyAvailability(practitionerId),
    getService("pelnoplatna"),
    getService("niskoplatna"),
    getAppointmentsForPractitioner(practitionerId),
  ]);

  const currentWeekStart = startOfWarsawWeek(new Date());
  const lowCostVisitsThisWeek = appointments.filter(
    (a) => a.serviceId === "niskoplatna" && startOfWarsawWeek(new Date(a.startsAt)) === currentWeekStart
  ).length;

  if (!pelnoplatna || !niskoplatna) {
    throw new Error("Brak zdefiniowanych usług pełnopłatnej lub niskopłatnej w katalogu.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Panel specjalisty</p>
        <h1 className="text-2xl font-bold tracking-tight">Dostępność</h1>
        <p className="text-sm text-muted-foreground">Godziny ustawiasz osobno dla każdej usługi.</p>
      </div>

      <WeeklyRhythmEditor
        initialAvailability={availability}
        services={{ pelnoplatna, niskoplatna }}
        lowCostVisitsThisWeek={lowCostVisitsThisWeek}
        lowCostVisitsLimit={LOW_COST_WEEKLY_VISIT_LIMIT}
      />
    </div>
  );
}

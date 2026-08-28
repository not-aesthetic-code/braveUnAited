import { redirect } from "next/navigation";
import {
  getAppointmentsForPractitioner,
  getBookedVisits,
  getHourOverrides,
  getService,
  getWeeklyAvailability,
} from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import { startOfWarsawWeek } from "@/lib/therapist-calendar";
import { WeeklyRhythmEditor } from "./weekly-rhythm-editor";

// Foundation rule: a specialist can take on at most this many low-cost
// visits per week — the pool resets every Monday (Warsaw time).
export const LOW_COST_WEEKLY_VISIT_LIMIT = 5;

// The grid always starts today, in the practitioner's own timezone — not the
// server's, which is why this goes through Intl rather than toISOString().
function warsawToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
}

export default async function DostepnoscPage() {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) redirect("/panel/login");

  const fromDate = warsawToday();
  const [availability, pelnoplatna, niskoplatna, appointments, overridesFull, overridesLow, visits] =
    await Promise.all([
      getWeeklyAvailability(practitionerId),
      getService("pelnoplatna"),
      getService("niskoplatna"),
      getAppointmentsForPractitioner(practitionerId),
      getHourOverrides(practitionerId, "pelnoplatna", fromDate),
      getHourOverrides(practitionerId, "niskoplatna", fromDate),
      getBookedVisits(practitionerId, fromDate),
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
        hourGrid={{
          fromDate,
          overrides: { pelnoplatna: overridesFull, niskoplatna: overridesLow },
          visits,
        }}
      />
    </div>
  );
}

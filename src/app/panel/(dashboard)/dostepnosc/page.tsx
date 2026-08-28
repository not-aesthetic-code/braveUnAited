import { redirect } from "next/navigation";
import {
  getBookedHourBlocks,
  getHourOverrides,
  getService,
  getWeeklyAvailability,
} from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import { WeeklyRhythmEditor } from "./weekly-rhythm-editor";
import { HourOverridesGrid } from "./hour-overrides-grid";

// The grid always starts today, in the practitioner's own timezone — not the
// server's, which is why this goes through Intl rather than toISOString().
function warsawToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
}

export default async function DostepnoscPage() {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) redirect("/panel/login");

  const fromDate = warsawToday();
  const [availability, pelnoplatna, niskoplatna, overridesFull, overridesLow, booked] = await Promise.all([
    getWeeklyAvailability(practitionerId),
    getService("pelnoplatna"),
    getService("niskoplatna"),
    getHourOverrides(practitionerId, "pelnoplatna", fromDate),
    getHourOverrides(practitionerId, "niskoplatna", fromDate),
    getBookedHourBlocks(practitionerId, fromDate),
  ]);

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

      <WeeklyRhythmEditor initialAvailability={availability} services={{ pelnoplatna, niskoplatna }} />

      <HourOverridesGrid
        fromDate={fromDate}
        availability={availability}
        overrides={{ pelnoplatna: overridesFull, niskoplatna: overridesLow }}
        booked={booked}
      />
    </div>
  );
}

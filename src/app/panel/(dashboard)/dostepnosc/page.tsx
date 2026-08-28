import { redirect } from "next/navigation";
import { getService, getWeeklyAvailability } from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import { WeeklyRhythmEditor } from "./weekly-rhythm-editor";

export default async function DostepnoscPage() {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) redirect("/panel/login");

  const [availability, pelnoplatna, niskoplatna] = await Promise.all([
    getWeeklyAvailability(practitionerId),
    getService("pelnoplatna"),
    getService("niskoplatna"),
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
    </div>
  );
}

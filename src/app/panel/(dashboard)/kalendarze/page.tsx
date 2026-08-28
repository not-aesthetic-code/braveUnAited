import { redirect } from "next/navigation";
import { getManagedServiceCards, PELNOPLATNA_RATE_OPTIONS } from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import { EnabledServiceCards } from "./enabled-service-cards";

export default async function MojeKalendarzePage() {
  const { practitionerId } = await getPractitionerSession();
  if (!practitionerId) redirect("/panel/login");

  const cards = await getManagedServiceCards(practitionerId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Panel specjalisty</p>
        <h1 className="text-2xl font-bold tracking-tight">Moje kalendarze</h1>
        <p className="text-sm text-muted-foreground">Każdy włączony kalendarz to osobna usługa z własnymi godzinami przyjęć.</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-secondary/40 p-5">
        <span aria-hidden className="mt-0.5 text-muted-foreground">🔒</span>
        <div className="text-sm">
          <p className="font-medium">Cennik i długość wizyt ustala fundacja</p>
          <p className="text-muted-foreground">
            Decydujesz, które usługi przyjmujesz i kiedy. Jedyna cena, którą wybierasz sama, to stawka pełnopłatna —
            z widełek {PELNOPLATNA_RATE_OPTIONS.join(" / ")} zł.
          </p>
        </div>
      </div>

      <EnabledServiceCards cards={cards} pelnoplatnaRateOptions={PELNOPLATNA_RATE_OPTIONS} />
    </div>
  );
}

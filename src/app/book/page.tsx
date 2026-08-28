import Link from "next/link";
import { getServices, listAvailableSlots, SERVICE_TYPES, type ServiceType } from "@/lib/appointments";
import { BookingFlow } from "./BookingFlow";

function isServiceType(value: string | undefined): value is ServiceType {
  return !!value && (SERVICE_TYPES as readonly string[]).includes(value);
}

// One combined calendar across every consultation type — a service card on
// the landing page still deep-links here with `?service=` to preselect that
// type's filter chip, but the flow itself (and its slot data) is shared by
// all of them instead of each type getting its own page + calendar.
export default async function BookPage(props: PageProps<"/book">) {
  const { service } = await props.searchParams;
  const serviceParam = Array.isArray(service) ? service[0] : service;
  const initialServiceType = isServiceType(serviceParam) ? serviceParam : undefined;

  const [slotsByType, services] = await Promise.all([
    Promise.all(SERVICE_TYPES.map((id) => listAvailableSlots(id))),
    getServices(),
  ]);
  const slots = slotsByType.flat();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-secondary-foreground">
          ← Wróć
        </Link>
        <p className="mt-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Rezerwacja</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-secondary-foreground">Umów wizytę</h1>
        <p className="mt-1 text-muted-foreground">Wybierz rodzaj konsultacji, dzień i wolny termin.</p>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak wolnych terminów.</p>
      ) : (
        <BookingFlow slots={slots} services={services} initialServiceType={initialServiceType} />
      )}
    </div>
  );
}

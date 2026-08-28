import Link from "next/link";
import { listAvailableSlots, SERVICE_LABELS, type ServiceType } from "@/lib/appointments";

function isServiceType(value: string | undefined): value is ServiceType {
  return !!value && value in SERVICE_LABELS;
}

export default async function BookPage(props: PageProps<"/book">) {
  const { service } = await props.searchParams;
  const serviceType = Array.isArray(service) ? service[0] : service;

  if (!isServiceType(serviceType)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-muted-foreground">Wybierz rodzaj konsultacji na stronie głównej.</p>
        <Link href="/" className="mt-4 inline-block underline">Wróć</Link>
      </div>
    );
  }

  const slots = listAvailableSlots(serviceType);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← Wróć</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{SERVICE_LABELS[serviceType].title}</h1>
        <p className="text-muted-foreground">Wybierz wolny termin.</p>
      </div>

      <ul className="flex flex-col gap-2">
        {slots.slice(0, 20).map((slot) => (
          <li
            key={`${slot.specialistId}|${slot.startsAt}`}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
          >
            <div>
              <p className="font-medium">{slot.specialistName}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(slot.startsAt).toLocaleString("pl-PL", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{slot.price > 0 ? `${slot.price} zł` : "Bezpłatnie"}</p>
              <p className="text-xs text-muted-foreground">Rezerwacja wkrótce</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

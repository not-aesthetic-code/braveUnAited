import Link from "next/link";
import { listAvailableSlots, SERVICE_LABELS, type ServiceType } from "@/lib/appointments";
import { BookingFlow } from "./BookingFlow";

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

  const slots = await listAvailableSlots(serviceType);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← Wróć</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{SERVICE_LABELS[serviceType].title}</h1>
        <p className="text-muted-foreground">Wybierz dzień, specjalistę i wolny termin.</p>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak wolnych terminów w tej kategorii.</p>
      ) : (
        <BookingFlow slots={slots} serviceType={serviceType} />
      )}
    </div>
  );
}

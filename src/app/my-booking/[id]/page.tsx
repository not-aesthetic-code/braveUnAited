import Link from "next/link";
import { Button } from "@/components/ui/button";
import { canManage, getAppointment, listAvailableSlots, SERVICE_LABELS } from "@/lib/appointments";
import { cancelBookingAction, rescheduleBookingAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  held: "Oczekuje na płatność",
  confirmed: "Potwierdzona",
  cancelled: "Odwołana",
  completed: "Odbyta",
  no_show: "Nieobecność",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Nieopłacona",
  paid: "Opłacona",
  refund_due: "Zwrot do wykonania",
  refunded: "Zwrócono",
};

export default async function ManageBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appt = getAppointment(id);

  if (!appt) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-muted-foreground">Nie znaleziono rezerwacji.</p>
        <Link href="/" className="mt-4 inline-block underline">Wróć na stronę główną</Link>
      </div>
    );
  }

  const { canCancel, canReschedule } = canManage(appt);
  const rescheduleOptions = canReschedule
    ? listAvailableSlots(appt.serviceType).filter((s) => s.specialistId === appt.specialistId)
    : [];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← Wróć</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Twoja rezerwacja</h1>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="font-medium">{SERVICE_LABELS[appt.serviceType].title}</p>
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
          <span>Płatność: <span className="font-medium">{PAYMENT_LABEL[appt.paymentStatus]}</span></span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {appt.price > 0 ? `${appt.price} zł` : "Bezpłatnie"}
        </p>
      </div>

      {appt.status === "confirmed" && !canCancel && (
        <p className="text-sm text-muted-foreground">
          Do wizyty zostało mniej niż 24 godziny — samodzielna zmiana lub odwołanie nie są już
          możliwe. Napisz bezpośrednio do specjalisty.
        </p>
      )}

      {canReschedule && (
        <form
          action={rescheduleBookingAction.bind(null, appt.id)}
          className="flex flex-col gap-3 rounded-xl border bg-card p-5"
        >
          <p className="font-medium">Przełóż termin</p>
          <p className="text-xs text-muted-foreground">
            Zmiana {appt.rescheduleCount} z 2 dozwolonych dla tej rezerwacji.
          </p>
          <select name="newStartsAt" required className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">Wybierz nowy termin…</option>
            {rescheduleOptions.map((s) => (
              <option key={s.startsAt} value={s.startsAt}>
                {new Date(s.startsAt).toLocaleString("pl-PL", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">Zapisz nowy termin</Button>
        </form>
      )}

      {canCancel && (
        <form action={cancelBookingAction.bind(null, appt.id)}>
          <Button type="submit" variant="destructive">Odwołaj wizytę</Button>
          {appt.price > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Zwrot {appt.price} zł zostanie zlecony ręcznie.</p>
          )}
        </form>
      )}
    </div>
  );
}

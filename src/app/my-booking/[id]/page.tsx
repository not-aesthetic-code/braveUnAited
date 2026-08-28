import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RescheduleCalendar } from "@/components/reschedule-calendar";
import { StatusBadge } from "@/components/status-badge";
import { CANCEL_REASONS, MAX_RESCHEDULES, canManage, cancelDeadline, confirmPayment, getAppointment, getPractitioner, listAvailableSlots } from "@/lib/appointments";
import { stripe } from "@/lib/stripe";
import { cancelBookingAction, payBookingAction, rescheduleBookingAction } from "./actions";

// A meeting_info value that looks like a URL renders as a link (video call);
// anything else — a street address — renders as plain text.
function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Nieopłacona",
  paid: "Opłacona",
  refund_due: "Zwrot do wykonania",
  refunded: "Zwrócono",
};

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { id } = await params;
  const { checkout, session_id: sessionId } = await searchParams;
  let appt = await getAppointment(id);

  // Fallback for local dev: the webhook (src/app/api/stripe/webhook) is the
  // real source of truth, but it only fires while `stripe listen` is running
  // — reconcile from the redirect itself too, so a payment doesn't look
  // "unpaid" forever just because the listener wasn't up at the time.
  if (appt?.status === "held" && checkout === "success" && sessionId) {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "unpaid") {
      appt = await confirmPayment(id).catch(() => appt);
    }
  }

  if (!appt) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-muted-foreground">Nie znaleziono rezerwacji.</p>
        <Link href="/" className="mt-4 inline-block underline">Wróć na stronę główną</Link>
      </div>
    );
  }

  const { canCancel, canReschedule, hoursUntil } = canManage(appt);
  const rescheduleOptions = canReschedule
    ? (await listAvailableSlots(appt.serviceId)).filter((s) => s.practitionerId === appt.practitionerId)
    : [];
  const practitioner = appt.status === "confirmed" ? await getPractitioner(appt.practitionerId) : undefined;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← Wróć</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Twoja rezerwacja</h1>
      </div>

      <div className="rounded-xl border bg-card p-5">
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
        <div className="mt-3 flex items-center gap-4 text-sm">
          <StatusBadge status={appt.status} />
          <span>Płatność: <span className="font-medium">{PAYMENT_LABEL[appt.paymentStatus]}</span></span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {appt.price > 0 ? `${appt.price} zł` : "Bezpłatnie"}
        </p>
      </div>

      {practitioner?.meetingInfo && (
        <div className="rounded-xl border bg-card p-5">
          <p className="font-medium">
            {isUrl(practitioner.meetingInfo) ? "Link do spotkania" : "Adres"}
          </p>
          {isUrl(practitioner.meetingInfo) ? (
            <a
              href={practitioner.meetingInfo}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline underline-offset-4"
            >
              {practitioner.meetingInfo}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">{practitioner.meetingInfo}</p>
          )}
        </div>
      )}

      {appt.status === "held" && (
        <form action={payBookingAction.bind(null, appt.id)}>
          <Button type="submit">
            {appt.price > 0 ? `Zapłać ${appt.price} zł i potwierdź` : "Potwierdź bezpłatną wizytę"}
          </Button>
        </form>
      )}

      {appt.status === "cancelled" && (
        <p className="text-sm text-muted-foreground">
          Termin wygasł lub został odwołany. <Link href="/" className="underline">Wybierz nowy termin</Link>.
        </p>
      )}

      {appt.status === "confirmed" && canCancel && (
        <p className="text-sm text-muted-foreground">
          Możesz jeszcze bezpłatnie {canReschedule ? "zmienić lub odwołać" : "odwołać"} — masz na to czas do{" "}
          <span className="font-medium text-foreground">
            {cancelDeadline(appt).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </span>
          .
        </p>
      )}

      {appt.status === "confirmed" && !canCancel && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Minął czas na bezpłatną zmianę. Wizyta jest płatna niezależnie od obecności. Decyzję o
            wyjątku podejmuje specjalista, nie system — napisz do niego bezpośrednio.
          </p>
          {practitioner?.email && (
            <a
              href={`mailto:${practitioner.email}?subject=${encodeURIComponent(
                `Wizyta ${new Date(appt.startsAt).toLocaleString("pl-PL")}`
              )}`}
            >
              <Button type="button" variant="outline">Napisz do specjalisty</Button>
            </a>
          )}
        </div>
      )}

      {canReschedule && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <p className="font-medium">Przełóż termin</p>
          <p className="text-xs text-muted-foreground">
            Zmienia się tylko godzina — specjalista, cena i forma wizyty zostają bez zmian.
          </p>
          <p className="text-xs text-muted-foreground">
            Zmiana {appt.rescheduleCount + 1} z 2 dozwolonych dla tej rezerwacji.
          </p>
          <RescheduleCalendar slots={rescheduleOptions} action={rescheduleBookingAction.bind(null, appt.id)} />
        </div>
      )}

      {appt.status === "confirmed" && canCancel && !canReschedule && (
        <div className="rounded-xl border bg-card p-5">
          <p className="font-medium">Przełóż termin</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tę wizytę przekładano już {appt.rescheduleCount} razy z dozwolonych {MAX_RESCHEDULES}. Kolejna
            zmiana wymaga kontaktu ze specjalistą. Odwołanie nadal jest możliwe.
          </p>
        </div>
      )}

      {canCancel && (
        <form
          action={cancelBookingAction.bind(null, appt.id)}
          className="flex flex-col gap-3 rounded-xl border bg-card p-5"
        >
          <p className="font-medium">Odwołaj wizytę</p>
          <p className="text-sm text-muted-foreground">
            Do wizyty zostało {Math.round(hoursUntil)} godz. — to więcej niż 24, więc wraca cała
            kwota. Termin natychmiast zwalnia się dla innych pacjentów.
          </p>
          {appt.price > 0 && (
            <p className="text-sm">
              Zapłacono: <span className="font-medium">{appt.price} zł</span> · Zwrot:{" "}
              <span className="font-medium">{appt.price} zł</span> (100%, zwykle w 3–5 dni roboczych)
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="reason" className="text-sm font-medium">Powód (nieobowiązkowo)</label>
            <select id="reason" name="reason" className="rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">Nie podaję powodu</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Powód trafia do zbiorczych statystyk fundacji; specjalista zobaczy go tylko przy tej wizycie.
            </p>
          </div>

          <Button type="submit" variant="destructive">Odwołaj wizytę</Button>
        </form>
      )}
    </div>
  );
}

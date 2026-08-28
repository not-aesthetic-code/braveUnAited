import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RescheduleCalendar } from "@/components/reschedule-calendar";
import {
  type Appointment,
  getAppointmentsForPractitioner,
  getPatientsToRemind,
  getPractitioner,
  listAvailableSlots,
  REMINDER_AFTER_WEEKS,
  type ServiceType,
  type Slot,
} from "@/lib/appointments";
import { getPractitionerSession } from "@/lib/panel-auth";
import {
  cancelPractitionerBookingAction,
  markNoShowAction,
  reschedulePractitionerBookingAction,
  sendReminderEmailAction,
} from "../actions";

const STATUS_LABEL: Record<string, string> = {
  held: "Oczekuje na płatność",
  confirmed: "Potwierdzona",
  cancelled: "Odwołana",
  completed: "Odbyta",
  no_show: "Nieobecność",
};

const DAY_MS = 86_400_000;

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function startOfDay(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
}

function AppointmentRow({
  appt,
  slots,
  now,
}: {
  appt: Appointment;
  slots: Slot[];
  now: Date;
}) {
  const isPast = new Date(appt.startsAt).getTime() < now.getTime();
  return (
    <div key={appt.id} className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
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
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{STATUS_LABEL[appt.status]}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span>Pacjent: <span className="font-medium">{appt.patient.name}</span></span>
        <span>Cena: <span className="font-medium">{appt.price} zł</span></span>
      </div>

      {appt.status === "confirmed" && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          <RescheduleCalendar slots={slots} action={reschedulePractitionerBookingAction.bind(null, appt.id)} />
          <form action={cancelPractitionerBookingAction.bind(null, appt.id)}>
            <Button type="submit" variant="destructive" size="sm">Odwołaj</Button>
          </form>
        </div>
      )}

      {appt.status === "confirmed" && isPast && (
        <form action={markNoShowAction.bind(null, appt.id)} className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="fullRefund" className="size-4 rounded border" />
            Potraktuj jako odwołanie z pełnym zwrotem
          </label>
          <Button type="submit" variant="outline" size="sm">Zgłoś nieobecność</Button>
        </form>
      )}
    </div>
  );
}

export default async function DoctorPanelPage() {
  const { claims, practitionerId } = await getPractitionerSession();
  if (!practitionerId) redirect("/panel/login");

  const now = new Date();
  const [practitioner, appointments, reminders] = await Promise.all([
    getPractitioner(practitionerId),
    getAppointmentsForPractitioner(practitionerId),
    getPatientsToRemind(practitionerId),
  ]);

  // Same practitioner for every row on this page, so fetch reschedule slots
  // once per distinct service instead of once per confirmed appointment.
  const confirmedServiceIds = [...new Set(
    appointments.filter((a) => a.status === "confirmed").map((a) => a.serviceId)
  )];
  const slotsByService = new Map<ServiceType, Slot[]>();
  await Promise.all(
    confirmedServiceIds.map(async (serviceId) => {
      const slots = await listAvailableSlots(serviceId);
      slotsByService.set(serviceId, slots.filter((s) => s.practitionerId === practitionerId));
    })
  );

  const today = appointments.filter((a) => isSameDay(a.startsAt, now));
  const upcoming = appointments.filter((a) => new Date(a.startsAt) >= startOfDay(now) && !isSameDay(a.startsAt, now));
  const awaitingPayment = appointments.filter((a) => a.status === "held");

  const next7d = appointments.filter((a) => {
    const t = new Date(a.startsAt).getTime();
    return t >= now.getTime() && t <= now.getTime() + 7 * DAY_MS;
  }).length;

  const earnings30d = appointments
    .filter((a) => a.status === "completed" && a.paymentStatus === "paid" && now.getTime() - new Date(a.startsAt).getTime() <= 30 * DAY_MS)
    .reduce((sum, a) => sum + a.price, 0);

  const stats = [
    { label: "Wizyty dzisiaj", value: String(today.length) },
    { label: "Wizyty (7 dni)", value: String(next7d) },
    { label: "Oczekują na płatność", value: String(awaitingPayment.length) },
    { label: "Wynagrodzenie (30 dni)", value: `${earnings30d} zł` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Panel specjalisty</p>
        <h1 className="text-2xl font-bold tracking-tight">
          Dzień dobry, {practitioner?.name ?? (claims?.email as string)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{s.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Dzisiaj</h2>
            {today.length === 0 && <p className="text-sm text-muted-foreground">Brak wizyt na dziś.</p>}
            {today.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} slots={slotsByService.get(appt.serviceId) ?? []} now={now} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Nadchodzące wizyty</h2>
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Brak zaplanowanych wizyt.</p>}
            {upcoming.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} slots={slotsByService.get(appt.serviceId) ?? []} now={now} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Wymaga uwagi</h2>

          {awaitingPayment.length === 0 && reminders.length === 0 && (
            <p className="text-sm text-muted-foreground">Nic nie wymaga teraz Twojej uwagi.</p>
          )}

          {awaitingPayment.map((appt) => (
            <div key={appt.id} className="rounded-xl border border-accent-foreground/20 bg-accent p-4 text-sm">
              <p className="font-medium text-accent-foreground">Oczekuje na płatność</p>
              <p className="mt-1">{appt.patient.name} · {appt.service.title}</p>
              <p className="text-muted-foreground">
                {new Date(appt.startsAt).toLocaleString("pl-PL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}

          {reminders.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Warto przypomnieć ({REMINDER_AFTER_WEEKS}+ tyg. bez kontaktu)
              </p>
              {reminders.map((r) => (
                <div key={r.patient.id} className="rounded-xl border bg-card p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{r.patient.name}</p>
                    <p className="text-muted-foreground">{r.patient.phone}</p>
                  </div>
                  <p className="text-muted-foreground">
                    Ostatnia wizyta:{" "}
                    {new Date(r.lastVisitAt).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    {r.patient.email ? (
                      <form action={sendReminderEmailAction.bind(null, r.patient.id)}>
                        <Button type="submit" variant="outline" size="sm">Wyślij przypomnienie e-mailem</Button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted-foreground">Brak e-maila — zadzwoń</span>
                    )}
                    {r.lastReminderSentAt && (
                      <span className="text-xs text-muted-foreground">
                        Ostatnio wysłano{" "}
                        {new Date(r.lastReminderSentAt).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import plLocale from "@fullcalendar/core/locales/pl.js";
import { Plus, X } from "lucide-react";
import { minutesOfEligibleAvailability, startOfWarsawWeek } from "@/lib/therapist-calendar";
import { AbsenceModal } from "./absence-modal";
import type { TherapistPanelData } from "@/lib/therapist-data";
import type { Appointment } from "@/lib/appointments";
import {
  addDays,
  appointmentClass,
  formatLongDate,
  localDate,
  localTime,
  statusLabel,
} from "../format";

export function CalendarScreen({ data }: { data: TherapistPanelData }) {
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const weekStart = startOfWarsawWeek(new Date());
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const visibleAppointments = data.appointments.filter((appointment) => appointment.status !== "cancelled");
  const nextAppointment = visibleAppointments.find((appointment) => new Date(appointment.startsAt) > new Date());

  const calendarEvents = [
    ...visibleAppointments.map((appointment) => ({
      id: appointment.id,
      title: `${appointment.patient.name} · ${appointment.service.title}`,
      start: appointment.startsAt,
      end: new Date(
        new Date(appointment.startsAt).getTime() + appointment.service.durationMinutes * 60_000,
      ).toISOString(),
      classNames: ["fc-visit", appointmentClass(appointment.serviceId)],
      extendedProps: { appointmentId: appointment.id },
    })),
    ...data.absences.map((absence) => ({
      id: `absence-${absence.id}`,
      title: absence.reason ? `Nieobecność · ${absence.reason}` : "Nieobecność",
      start: `${absence.date}T${absence.startTime}:00`,
      end: `${absence.date}T${absence.endTime}:00`,
      classNames: ["fc-absence"],
      extendedProps: { absence: true },
    })),
  ];

  return (
    <div className="panel-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Twój grafik</p>
          <h1>Kalendarz</h1>
          <p>Wizyty, dostępność i nieobecności w jednym miejscu.</p>
        </div>
        <button className="primary-action" onClick={() => setAbsenceOpen(true)}>
          <Plus size={17} />
          Oznacz nieobecność
        </button>
      </div>

      <section className="summary-grid">
        <Summary
          label="Wizyty w tym tygodniu"
          value={String(visibleAppointments.filter((a) => weekDates.includes(localDate(a.startsAt))).length)}
          note="bez anulowanych"
        />
        <Summary
          label="Najbliższa wizyta"
          value={nextAppointment ? localTime(nextAppointment.startsAt) : "—"}
          note="według czasu Warszawa"
        />
        <Summary
          label="Godziny społeczne"
          value={`${Math.floor(minutesOfEligibleAvailability(data.availability) / 60)} h`}
          note="wymagane minimum 5 h"
          positive
        />
      </section>

      <section className="calendar-card fullcalendar-wrap">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={plLocale}
          firstDay={1}
          headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth" }}
          buttonText={{ today: "Dzisiaj", week: "Tydzień", month: "Miesiąc" }}
          allDaySlot={false}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          slotDuration="00:30:00"
          nowIndicator
          height="auto"
          events={calendarEvents}
          eventClick={(info) => {
            const appointmentId = info.event.extendedProps.appointmentId as string | undefined;
            if (appointmentId) {
              setSelected(visibleAppointments.find((item) => item.id === appointmentId) ?? null);
            }
          }}
          eventContent={(info) =>
            info.event.extendedProps.absence ? (
              <div className="fc-event-copy">
                <b>Nieobecność</b>
                <span>{info.event.title.replace("Nieobecność · ", "")}</span>
              </div>
            ) : (
              <div className="fc-event-copy">
                <b>{info.timeText}</b>
                <span>{info.event.title}</span>
              </div>
            )
          }
        />
      </section>

      {selected && (
        <AppointmentModal appointment={selected} all={visibleAppointments} onClose={() => setSelected(null)} />
      )}
      {absenceOpen && <AbsenceModal onClose={() => setAbsenceOpen(false)} />}
    </div>
  );
}

function Summary({ label, value, note, positive = false }: { label: string; value: string; note: string; positive?: boolean }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={positive ? "positive" : ""}>{note}</small>
    </div>
  );
}

function AppointmentModal({
  appointment,
  all,
  onClose,
}: {
  appointment: Appointment;
  all: Appointment[];
  onClose: () => void;
}) {
  const history = all.filter(
    (item) =>
      item.patientId === appointment.patientId &&
      item.id !== appointment.id &&
      new Date(item.startsAt) < new Date(appointment.startsAt),
  );
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="panel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Zamknij" onClick={onClose}>
          <X size={20} />
        </button>
        <p className="eyebrow">Szczegóły wizyty</p>
        <h2 id="visit-title">{appointment.patient.name}</h2>
        <p className="modal-subtitle">
          {formatLongDate(appointment.startsAt)} · {localTime(appointment.startsAt)}
        </p>
        <dl className="detail-list">
          <div>
            <dt>Usługa</dt>
            <dd>{appointment.service.title}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="status-badge">{statusLabel(appointment.status)}</span>
            </dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{appointment.patient.email || "—"}</dd>
          </div>
          <div>
            <dt>Telefon</dt>
            <dd>{appointment.patient.phone}</dd>
          </div>
          <div>
            <dt>Płatność</dt>
            <dd>
              {appointment.paymentStatus === "paid"
                ? "Opłacona"
                : appointment.paymentStatus === "pending"
                  ? "Oczekuje"
                  : "Zwrot do wykonania"}
            </dd>
          </div>
        </dl>
        <div className="history-box">
          <b>Historia pacjenta</b>
          <p>
            {history.length
              ? `${history.length} wcześniejsze wizyty w fundacji. Ostatnia: ${formatLongDate(history.at(-1)!.startsAt)}.`
              : "To pierwsza wizyta tej osoby w fundacji."}
          </p>
        </div>
      </section>
    </div>
  );
}

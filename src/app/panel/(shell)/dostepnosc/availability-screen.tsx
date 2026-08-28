"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarClock, Info, Plus, TriangleAlert, X } from "lucide-react";
import {
  REQUIRED_COMMUNITY_MINUTES,
  buildHourGrid,
  countWeeklySlots,
  gridDates,
  gridHours,
  minutesOfEligibleAvailability,
  nextCorrection,
  type BusyBlock,
  type CommunityServiceType,
  type HourCorrection,
  type WeeklyAvailabilityInput,
} from "@/lib/therapist-calendar";
import type { TherapistPanelData } from "@/lib/therapist-data";
import { saveAvailabilityAction, toggleHourCorrectionAction } from "../../actions";
import { AbsenceModal } from "../absence-modal";
import {
  FULL_DAYS,
  SHORT_DAYS,
  formatDayNumber,
  formatShortDate,
  localDate,
  minutesLabel,
} from "../../format";

const SERVICE_TABS: { id: CommunityServiceType; label: string }[] = [
  { id: "niskoplatna", label: "Konsultacje niskopłatne" },
  { id: "bezplatna", label: "Darmowe konsultacje" },
];

const CELL_LABEL: Record<string, string> = {
  rhythm: "z rytmu tygodniowego",
  added: "dodana ręcznie",
  disabled: "wyłączona",
  busy: "zajęta przez pacjenta",
  absence: "wolne / urlop",
  empty: "wolna — kliknij, aby otworzyć",
};

type Props = {
  data: TherapistPanelData;
  rules: { label: string; value: string }[];
};

export function AvailabilityScreen({ data, rules }: Props) {
  const [service, setService] = useState<CommunityServiceType>("niskoplatna");
  const [ranges, setRanges] = useState<WeeklyAvailabilityInput[]>(
    data.availability.map(({ weekday, startTime, endTime, serviceType }) => ({
      weekday,
      startTime,
      endTime,
      serviceType,
    })),
  );
  const [corrections, setCorrections] = useState<HourCorrection[]>(data.corrections);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const today = localDate(new Date().toISOString());
  const minutes = minutesOfEligibleAvailability(ranges);
  const serviceRanges = ranges.filter((range) => range.serviceType === service);

  // Booked visits outrank every editable cell, so the grid needs them as
  // whole-hour blocks rather than as appointments.
  const busy: BusyBlock[] = useMemo(
    () =>
      data.appointments.map((appointment) => {
        const start = new Date(appointment.startsAt);
        const startHour = Number(
          new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hourCycle: "h23" }).format(start),
        );
        const startMinute = Number(
          new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", minute: "2-digit" }).format(start),
        );
        const endMinutes = startHour * 60 + startMinute + appointment.service.durationMinutes;
        return {
          date: localDate(appointment.startsAt),
          startHour,
          endHour: Math.ceil(endMinutes / 60),
        };
      }),
    [data.appointments],
  );

  const cells = useMemo(
    () =>
      buildHourGrid({
        from: today,
        serviceType: service,
        rhythm: ranges,
        corrections,
        absences: data.absences,
        busy,
      }),
    [today, service, ranges, corrections, data.absences, busy],
  );
  const cellAt = (date: string, hour: number) =>
    cells.find((cell) => cell.date === date && cell.hour === hour)!;

  const addedCount = corrections.filter((item) => item.serviceType === service && item.kind === "open").length;
  const disabledCount = corrections.filter((item) => item.serviceType === service && item.kind === "closed").length;

  function updateRange(index: number, patch: Partial<WeeklyAvailabilityInput>) {
    setRanges((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  }

  function save() {
    startTransition(async () => {
      const result = await saveAvailabilityAction(ranges);
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  function toggleCell(date: string, hour: number) {
    const cell = cellAt(date, hour);
    const intent = nextCorrection(cell.state);
    if (!intent) return;

    const previous = corrections;
    const startTime = `${String(hour).padStart(2, "0")}:00`;
    const withoutCell = corrections.filter(
      (item) => !(item.date === date && item.startTime === startTime && item.serviceType === service),
    );
    setCorrections(
      intent === "clear"
        ? withoutCell
        : [...withoutCell, { id: `local-${date}-${hour}-${service}`, date, startTime, kind: intent, serviceType: service }],
    );

    startTransition(async () => {
      const result = await toggleHourCorrectionAction({ date, hour, serviceType: service, intent });
      if (!result.ok) {
        setCorrections(previous);
        setMessage({ ok: false, text: result.message });
      }
    });
  }

  const doubleBooked = findSharedWindow(ranges);

  return (
    <div className="panel-content">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Panel specjalisty</p>
          <h1>Dostępność</h1>
          <p>Godziny ustawiasz osobno dla każdej usługi.</p>
        </div>
        <button className="primary-action" onClick={save} disabled={pending || minutes < REQUIRED_COMMUNITY_MINUTES}>
          {pending ? "Zapisywanie…" : "Zapisz harmonogram"}
        </button>
      </header>

      <div className="zakladki" role="tablist" aria-label="Rodzaj konsultacji">
        {SERVICE_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            className="zakladka"
            aria-selected={service === tab.id}
            onClick={() => setService(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && <div className={message.ok ? "form-success" : "form-error"}>{message.text}</div>}

      <section className="card stos">
        <div className="rzad rzad--rozsuniety">
          <div>
            <h2 className="h4">1. Tygodniowy rytm</h2>
            <p className="tekst-przygaszony">
              Ustaw raz, a system pokroi zakresy na wizyty po 50 minut z 10-minutową przerwą.
            </p>
          </div>
          <span className="badge badge--akcent">{countWeeklySlots(serviceRanges)} terminów tygodniowo</span>
        </div>

        <div className="requirement">
          <div>
            <span>Obowiązkowe godziny społeczne</span>
            <strong>
              {minutesLabel(minutes)} / {minutesLabel(REQUIRED_COMMUNITY_MINUTES)}
            </strong>
          </div>
          <div className="progress">
            <i style={{ width: `${Math.min(100, (minutes / REQUIRED_COMMUNITY_MINUTES) * 100)}%` }} />
          </div>
          <small>Łącznie wizyty 55 zł i Darmowe — limit liczy się z obu zakładek naraz.</small>
        </div>

        <div className="rytm-lista">
          {FULL_DAYS.map((dayName, index) => {
            const weekday = index + 1;
            const dayRanges = ranges
              .map((range, position) => ({ range, position }))
              .filter((item) => item.range.serviceType === service && item.range.weekday === weekday);
            return (
              <div className="rytm-dzien" key={dayName}>
                <div className="rytm-dzien__nazwa">{dayName}</div>
                <div className="rytm-dzien__zakresy">
                  {dayRanges.length === 0 && <p className="tekst-przygaszony">Nie przyjmujesz w ten dzień.</p>}
                  {dayRanges.map(({ range, position }) => (
                    <div className="range-row" key={position}>
                      <input
                        type="time"
                        aria-label={`Początek, ${dayName}`}
                        value={range.startTime}
                        onChange={(event) => updateRange(position, { startTime: event.target.value })}
                      />
                      <span>do</span>
                      <input
                        type="time"
                        aria-label={`Koniec, ${dayName}`}
                        value={range.endTime}
                        onChange={(event) => updateRange(position, { endTime: event.target.value })}
                      />
                      <span className="badge">{countWeeklySlots([range])} terminów</span>
                      <button
                        className="remove-range"
                        aria-label={`Usuń zakres, ${dayName}`}
                        onClick={() => setRanges((current) => current.filter((_, i) => i !== position))}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="add-range"
                  onClick={() =>
                    setRanges((current) => [
                      ...current,
                      { weekday, startTime: "09:00", endTime: "10:00", serviceType: service },
                    ])
                  }
                >
                  <Plus size={16} />
                  Zakres
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stos">
        <div className="rzad rzad--rozsuniety">
          <div>
            <h2 className="h4">2. Poprawki na konkretnych godzinach</h2>
            <p className="tekst-przygaszony">
              Rytm powyżej wypełnia siatkę automatycznie. Tutaj klikasz pojedyncze godziny: wyłączasz te, których nie
              chcesz, i dokładasz takie, których w rytmie nie ma.
            </p>
          </div>
          <div className="rzad">
            <span className="badge badge--sukces">+{addedCount} dodanych</span>
            <span className="badge">−{disabledCount} wyłączonych</span>
          </div>
        </div>

        <div className="legenda">
          <span>
            <i className="kropka kropka--rytm" />z rytmu tygodniowego
          </span>
          <span>
            <i className="kropka kropka--dodana" />
            dodana ręcznie
          </span>
          <span>
            <i className="kropka kropka--wylaczona" />
            wyłączona
          </span>
          <span>
            <i className="kropka kropka--zajeta" />
            zajęta przez pacjenta
          </span>
        </div>

        <div className="tabela-scroll">
          <div className="siatka-godzin" style={{ gridTemplateColumns: "56px repeat(7, minmax(40px, 1fr))" }}>
            <div />
            {gridDates(today).map((date) => (
              <div className="siatka-naglowek" key={date}>
                <div className="siatka-naglowek__dzien">{SHORT_DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]}</div>
                <div className="siatka-naglowek__data">{formatDayNumber(date)}</div>
              </div>
            ))}
            {gridHours().map((hour) => (
              <Row key={hour} hour={hour} dates={gridDates(today)} cellAt={cellAt} onToggle={toggleCell} />
            ))}
          </div>
        </div>

        <div className="baner baner--info">
          <Info size={18} />
          <span>
            <strong>Poprawki są jednorazowe</strong>
            Wyłączenie godziny dotyczy tylko tego konkretnego dnia. Jeśli chcesz zmienić coś na stałe, popraw rytm
            tygodniowy powyżej — inaczej za tydzień wróci to samo. Siatka pokazuje 7 dni, bo tylko na tyle wolno
            wystawiać terminy.
          </span>
        </div>
      </section>

      <section className="card stos">
        <h2 className="h4">Wolne i urlopy</h2>
        <p className="tekst-przygaszony">
          Wyjątek wygrywa ze wszystkim — z rytmem i z ręcznymi poprawkami. Dotyczy wszystkich Twoich usług naraz.
        </p>
        <div className="tabela-scroll">
          <table className="tabela">
            <thead>
              <tr>
                <th>Od</th>
                <th>Do</th>
                <th>Powód</th>
                <th>Wizyty w tym czasie</th>
              </tr>
            </thead>
            <tbody>
              {data.absences.length === 0 && (
                <tr>
                  <td colSpan={4} className="tekst-przygaszony">
                    Nie masz zaplanowanych wolnych dni.
                  </td>
                </tr>
              )}
              {data.absences.map((absence) => {
                const conflicts = busy.filter(
                  (block) =>
                    block.date === absence.date &&
                    block.startHour < Number(absence.endTime.slice(0, 2)) &&
                    Number(absence.startTime.slice(0, 2)) < block.endHour,
                ).length;
                return (
                  <tr key={absence.id}>
                    <td>
                      {formatShortDate(absence.date)} {absence.startTime}
                    </td>
                    <td>
                      {formatShortDate(absence.date)} {absence.endTime}
                    </td>
                    <td>{absence.reason || "—"}</td>
                    <td>
                      {conflicts === 0 ? (
                        <span className="badge badge--sukces">brak kolizji</span>
                      ) : (
                        <span className="badge badge--uwaga">{conflicts} do przełożenia</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rzad">
          <button className="secondary-action" onClick={() => setAbsenceOpen(true)}>
            <Plus size={16} />
            Dodaj wolne
          </button>
        </div>
      </section>

      <div className="siatka siatka--2">
        <section className="card card--warm stos">
          <h2 className="h4">Reguły, których nie zmieniasz</h2>
          <p className="tekst-przygaszony">Ustawia je fundacja, żeby wszystkie kalendarze zachowywały się tak samo.</p>
          <dl className="lista-podsumowania">
            {rules.map((rule) => (
              <div key={rule.label}>
                <dt>{rule.label}</dt>
                <dd>{rule.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card stos">
          <h2 className="h4">Kalendarz zewnętrzny</h2>
          <p className="tekst-przygaszony">
            Po podłączeniu zajęte terminy z Twojego prywatnego kalendarza automatycznie znikną z oferty. Nikt nie
            zobaczy ich treści — tylko fakt, że jesteś zajęta.
          </p>
          <div className="rzad">
            <button className="secondary-action" disabled title="Integracja poza zakresem tej wersji">
              <CalendarClock size={16} />
              Połącz z Google
            </button>
          </div>
        </section>
      </div>

      {doubleBooked && (
        <div className="baner baner--uwaga">
          <TriangleAlert size={18} />
          <span>
            <strong>
              {FULL_DAYS[doubleBooked.weekday - 1]} {doubleBooked.startTime}–{doubleBooked.endTime} masz w dwóch
              kalendarzach
            </strong>
            Ten sam czas jest otwarty dla konsultacji niskopłatnej i darmowej. To dozwolone — pacjent zobaczy go w obu
            miejscach, a rezerwacja w jednym natychmiast zamknie go w drugim. Jeśli nie o to chodziło, zawęź jeden z
            zakresów.
          </span>
        </div>
      )}

      <p className="notka">
        <span>
          <b>Dlaczego dwa poziomy, a nie sam kalendarz do klikania:</b> rytm tygodniowy ustawia się raz na kilka
          miesięcy i to on odpowiada za 90% terminów. Ręczne klikanie po siatce jest potrzebne na wyjątki, ale jako
          jedyny sposób wymagałoby powtarzania tej samej pracy co miesiąc.
        </span>
      </p>

      {absenceOpen && <AbsenceModal onClose={() => setAbsenceOpen(false)} />}
    </div>
  );
}

function Row({
  hour,
  dates,
  cellAt,
  onToggle,
}: {
  hour: number;
  dates: string[];
  cellAt: (date: string, hour: number) => { state: string };
  onToggle: (date: string, hour: number) => void;
}) {
  return (
    <>
      <div className="siatka-godzina">{String(hour).padStart(2, "0")}:00</div>
      {dates.map((date) => {
        const { state } = cellAt(date, hour);
        const locked = state === "busy" || state === "absence";
        return (
          <button
            key={`${date}-${hour}`}
            type="button"
            className={`komorka-godziny komorka-godziny--${state}`}
            disabled={locked}
            aria-pressed={state === "rhythm" || state === "added"}
            title={CELL_LABEL[state]}
            onClick={() => onToggle(date, hour)}
          >
            <span className="sr-only">
              {formatShortDate(date)} {String(hour).padStart(2, "0")}:00 — {CELL_LABEL[state]}
            </span>
          </button>
        );
      })}
    </>
  );
}

/** First weekday range that both community services have open at the same time. */
function findSharedWindow(ranges: WeeklyAvailabilityInput[]) {
  for (const low of ranges.filter((range) => range.serviceType === "niskoplatna")) {
    const overlap = ranges.find(
      (range) =>
        range.serviceType === "bezplatna" &&
        range.weekday === low.weekday &&
        range.startTime < low.endTime &&
        low.startTime < range.endTime,
    );
    if (overlap) {
      return {
        weekday: low.weekday,
        startTime: low.startTime < overlap.startTime ? overlap.startTime : low.startTime,
        endTime: low.endTime < overlap.endTime ? low.endTime : overlap.endTime,
      };
    }
  }
  return null;
}

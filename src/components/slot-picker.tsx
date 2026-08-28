"use client";

import { useMemo, useState } from "react";
import { Globe, MapPin } from "lucide-react";
import type { Practitioner, Service, ServiceType, Slot } from "@/lib/appointments";

const dayKey = (d: Date) => d.toDateString();
const dateKey = (iso: string) => dayKey(new Date(iso));

const WEEKDAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

// One color per consultation type so the combined calendar can tell them
// apart at a glance — same 5 ids as SERVICE_TYPES in lib/appointments.
const SERVICE_TYPE_STYLES: Record<ServiceType, { dot: string; active: string }> = {
  niskoplatna: { dot: "bg-sky-500", active: "border-sky-500 text-sky-600" },
  pelnoplatna: { dot: "bg-violet-500", active: "border-violet-500 text-violet-600" },
  adhd_diagnoza: { dot: "bg-amber-500", active: "border-amber-500 text-amber-600" },
  asystent_zdrowienia: { dot: "bg-emerald-500", active: "border-emerald-500 text-emerald-600" },
  bezplatna: { dot: "bg-rose-500", active: "border-rose-500 text-rose-600" },
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// 6 full weeks, Monday–Sunday, including the leading/trailing days from
// neighboring months — same grid shape as every calendar app.
function buildMonthGrid(monthDate: Date): Date[] {
  const first = startOfMonth(monthDate);
  const mondayOffset = (first.getDay() + 6) % 7; // getDay(): 0=Sun..6=Sat
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function firstByTime(list: Slot[]): Slot | undefined {
  return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

// Calendar → day → time → specialist: pick a day (dots show which
// consultation types are open that day), pick one of that day's times, then
// pick whoever has that slot. Shared by the booking flow and every
// reschedule flow (patient + panel) so picking a new time always looks and
// behaves the same, instead of a plain <select> dropdown in some places and
// this calendar in others.
export function SlotPicker({
  slots,
  selectedSlot,
  onSelect,
  onDayChange,
  services = [],
  practitioners = [],
  initialServiceType,
}: {
  slots: Slot[];
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
  // Called when the user picks a different day or time — lets a caller
  // mid-flow (e.g. the booking form) drop back to browsing instead of
  // leaving a stale slot/phase selected under the newly picked day/time.
  onDayChange?: () => void;
  // Titles + durations for the specialist cards and the type filter's
  // labels — reschedule flows (always a single, already-known service) can
  // skip this since it only enriches the display.
  services?: Service[];
  // Meeting mode (video link vs address) for the specialist cards —
  // reschedule flows can skip this too.
  practitioners?: Practitioner[];
  // Preselects the type filter (e.g. arriving via /book?service=X) without
  // hiding the other types — the calendar still combines every type.
  initialServiceType?: ServiceType;
}) {
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const practitionerById = useMemo(() => new Map(practitioners.map((p) => [p.id, p])), [practitioners]);

  const serviceTypesPresent = useMemo(() => {
    const seen = new Map<ServiceType, string>();
    for (const s of slots) if (!seen.has(s.serviceId)) seen.set(s.serviceId, serviceById.get(s.serviceId)?.title ?? s.serviceId);
    return [...seen.entries()];
  }, [slots, serviceById]);

  const specialists = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots) seen.set(s.practitionerId, s.practitionerName);
    return [...seen.entries()];
  }, [slots]);

  const days = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots) if (!seen.has(dateKey(s.startsAt))) seen.set(dateKey(s.startsAt), s.startsAt);
    return [...seen.values()].sort();
  }, [slots]);

  const initialRelevant = initialServiceType ? slots.filter((s) => s.serviceId === initialServiceType) : slots;
  const [selectedDay, setSelectedDay] = useState(() => firstByTime(initialRelevant)?.startsAt);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(() => {
    const first = firstByTime(initialRelevant);
    return first ? formatTime(first.startsAt) : undefined;
  });
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>("all");
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | "all">(initialServiceType ?? "all");
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(days[0] ? new Date(days[0]) : new Date())
  );

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      if (selectedServiceType !== "all" && s.serviceId !== selectedServiceType) continue;
      if (selectedSpecialist !== "all" && s.practitionerId !== selectedSpecialist) continue;
      const key = dateKey(s.startsAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(s);
      else map.set(key, [s]);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [slots, selectedSpecialist, selectedServiceType]);

  const monthGrid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const daySlots = (selectedDay && slotsByDay.get(dateKey(selectedDay))) || [];

  const timesForDay = useMemo(() => {
    const seen = new Map<string, string>(); // formatted time -> earliest matching startsAt (sort key)
    for (const s of daySlots) {
      const label = formatTime(s.startsAt);
      if (!seen.has(label)) seen.set(label, s.startsAt);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([label]) => label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- daySlots is a fresh [] each render when empty, keying off the day/map avoids re-deriving it
  }, [slotsByDay, selectedDay]);

  const candidateSlots = daySlots
    .filter((s) => formatTime(s.startsAt) === selectedTime)
    .sort((a, b) => a.practitionerName.localeCompare(b.practitionerName));

  function pickDay(day: Slot[]) {
    const first = day[0];
    if (!first) return;
    setSelectedDay(first.startsAt);
    setSelectedTime(formatTime(first.startsAt));
    onDayChange?.();
  }

  function pickTime(time: string) {
    setSelectedTime(time);
    onDayChange?.();
  }

  return (
    <div className="flex flex-col gap-6">
      {serviceTypesPresent.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedServiceType("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedServiceType === "all"
                ? "border-primary text-primary"
                : "border-transparent bg-muted text-muted-foreground hover:text-secondary-foreground"
            }`}
          >
            Wszystkie rodzaje
          </button>
          {serviceTypesPresent.map(([id, title]) => (
            <button
              type="button"
              key={id}
              onClick={() => setSelectedServiceType(id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedServiceType === id
                  ? SERVICE_TYPE_STYLES[id].active
                  : "border-transparent bg-muted text-muted-foreground hover:text-secondary-foreground"
              }`}
            >
              <span className={`size-2 rounded-full ${SERVICE_TYPE_STYLES[id].dot}`} />
              {title}
            </button>
          ))}
        </div>
      )}

      {specialists.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedSpecialist("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedSpecialist === "all"
                ? "border-primary text-primary"
                : "border-transparent bg-muted text-muted-foreground hover:text-secondary-foreground"
            }`}
          >
            Wszyscy specjaliści
          </button>
          {specialists.map(([id, name]) => (
            <button
              type="button"
              key={id}
              onClick={() => setSelectedSpecialist(id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedSpecialist === id
                  ? "border-primary text-primary"
                  : "border-transparent bg-muted text-muted-foreground hover:text-secondary-foreground"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-4xl border border-border bg-card p-6 md:p-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[320px_150px_1fr]">
          {/* calendar — availability only exists within the 7-day publish
              horizon (listAvailableSlots), so most cells are simply unbookable */}
          <div>
            <div className="flex items-center justify-between pb-4">
              <button
                type="button"
                aria-label="Poprzedni miesiąc"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
                className="rounded-md px-2 py-1 text-lg text-muted-foreground transition-colors hover:text-secondary-foreground"
              >
                ‹
              </button>
              <p className="text-lg font-bold capitalize text-secondary-foreground">
                {viewMonth.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}
              </p>
              <button
                type="button"
                aria-label="Następny miesiąc"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="rounded-md px-2 py-1 text-lg text-muted-foreground transition-colors hover:text-secondary-foreground"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="py-1.5">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((d) => {
                const key = dayKey(d);
                const inMonth = d.getMonth() === viewMonth.getMonth();
                const isToday = key === dayKey(new Date());
                const isSelected = !!selectedDay && key === dateKey(selectedDay);
                const daySlotsForCell = slotsByDay.get(key) ?? [];
                const hasSlots = daySlotsForCell.length > 0;
                const types = [...new Set(daySlotsForCell.map((s) => s.serviceId))];

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!hasSlots}
                    onClick={() => pickDay(daySlotsForCell)}
                    className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors ${
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : isToday
                          ? "border border-primary text-primary"
                          : hasSlots
                            ? "cursor-pointer bg-primary/5 text-foreground hover:bg-primary/10"
                            : `cursor-default ${inMonth ? "text-muted-foreground/40" : "text-muted-foreground/15"}`
                    }`}
                  >
                    {d.getDate()}
                    {hasSlots && (
                      <span className="flex gap-0.5">
                        {isSelected ? (
                          <span className="size-1.5 rounded-full bg-primary-foreground/70" />
                        ) : (
                          types.slice(0, 3).map((id) => (
                            <span key={id} className={`size-1.5 rounded-full ${SERVICE_TYPE_STYLES[id].dot}`} />
                          ))
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* times for the selected day */}
          <div className="flex flex-col gap-3 border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            {selectedDay && (
              <p className="text-sm font-semibold capitalize text-secondary-foreground">
                {new Date(selectedDay).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            )}
            {timesForDay.length === 0 && <p className="text-sm text-muted-foreground">Brak wolnych godzin.</p>}
            {timesForDay.map((time) => (
              <button
                type="button"
                key={time}
                onClick={() => pickTime(time)}
                className={`w-full rounded-full border-2 px-4 py-2.5 text-center text-sm font-bold transition-colors ${
                  time === selectedTime
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary text-primary hover:bg-primary/5"
                }`}
              >
                {time}
              </button>
            ))}
          </div>

          {/* who's free at that day + time */}
          <div className="flex flex-col gap-3 border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            {selectedDay && selectedTime && (
              <p className="text-sm font-semibold capitalize text-secondary-foreground">
                {new Date(selectedDay).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })} · {selectedTime}
              </p>
            )}
            {candidateSlots.length === 0 && (
              <p className="text-sm text-muted-foreground">Wybierz dzień i godzinę, żeby zobaczyć dostępnych specjalistów.</p>
            )}
            {candidateSlots.map((slot) => {
              const isSelected = selectedSlot?.startsAt === slot.startsAt && selectedSlot?.practitionerId === slot.practitionerId;
              const service = serviceById.get(slot.serviceId);
              const meeting = practitionerById.get(slot.practitionerId)?.meetingInfo ?? null;
              const isOnline = meeting?.startsWith("http") ?? false;
              return (
                <button
                  type="button"
                  key={`${slot.practitionerId}|${slot.startsAt}`}
                  onClick={() => onSelect(slot)}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card hover:border-secondary-foreground hover:bg-secondary"
                  }`}
                >
                  {/* ponytail: initials avatar — swap for practitioner.photoUrl once we have real photos */}
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials(slot.practitionerName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-secondary-foreground">{slot.practitionerName}</p>
                    {service && <p className="text-sm text-muted-foreground">{service.title}</p>}
                    {meeting && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {isOnline ? <Globe className="size-3.5" /> : <MapPin className="size-3.5" />}
                        {isOnline ? "Online" : meeting}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-secondary-foreground">
                      {slot.price > 0 ? `${slot.price} zł` : "Bezpłatnie"}
                    </p>
                    {service && <p className="text-xs text-muted-foreground">{service.durationMinutes} min</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

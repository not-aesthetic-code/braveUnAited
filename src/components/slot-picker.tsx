"use client";

import { useMemo, useState } from "react";
import type { Service, ServiceType, Slot } from "@/lib/appointments";

const dayKey = (d: Date) => d.toDateString();
const dateKey = (iso: string) => dayKey(new Date(iso));

const WEEKDAY_LABELS = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

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

// 6 full weeks (Sun–Sat), including the leading/trailing days from
// neighboring months — same grid shape as every calendar app.
function buildMonthGrid(monthDate: Date): Date[] {
  const first = startOfMonth(monthDate);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
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

// Month calendar + consultation-type filter + specialist filter + time-slot
// grid for the selected day. Shared by the booking flow and every reschedule
// flow (patient + panel) so picking a new time always looks and behaves the
// same, instead of a plain <select> dropdown in some places and this
// calendar in others.
export function SlotPicker({
  slots,
  selectedSlot,
  onSelect,
  onDayChange,
  services = [],
  initialServiceType,
}: {
  slots: Slot[];
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
  // Called when the user picks a different day — lets a caller mid-flow
  // (e.g. the booking form) drop back to browsing instead of leaving a
  // stale slot/phase selected under the newly picked day.
  onDayChange?: () => void;
  // Titles for the type filter's labels — reschedule flows (always a single
  // service) can skip this since the filter only renders with 2+ types.
  services?: Service[];
  // Preselects the type filter (e.g. arriving via /book?service=X) without
  // hiding the other types — the calendar still combines every type.
  initialServiceType?: ServiceType;
}) {
  const serviceTitleById = useMemo(() => new Map(services.map((s) => [s.id, s.title])), [services]);

  const serviceTypesPresent = useMemo(() => {
    const seen = new Map<ServiceType, string>();
    for (const s of slots) if (!seen.has(s.serviceId)) seen.set(s.serviceId, serviceTitleById.get(s.serviceId) ?? s.serviceId);
    return [...seen.entries()];
  }, [slots, serviceTitleById]);

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

  const [selectedDay, setSelectedDay] = useState(() => {
    const relevant = initialServiceType ? slots.filter((s) => s.serviceId === initialServiceType) : slots;
    return [...relevant].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.startsAt;
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

  const visibleSlots = slots
    .filter((s) => selectedDay && dateKey(s.startsAt) === dateKey(selectedDay))
    .filter((s) => selectedServiceType === "all" || s.serviceId === selectedServiceType)
    .filter((s) => selectedSpecialist === "all" || s.practitionerId === selectedSpecialist)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="flex flex-col gap-6">
      {/* month calendar — availability only exists within the 7-day publish
          horizon (listAvailableSlots), so most cells are simply unbookable */}
      <div className="overflow-hidden rounded-4xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <p className="text-xl font-bold capitalize text-secondary-foreground">
            {viewMonth.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Poprzedni miesiąc"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="rounded-md border px-2 py-1 text-sm transition-colors hover:border-secondary-foreground hover:text-secondary-foreground"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setViewMonth(startOfMonth(new Date()))}
              className="rounded-md border px-3 py-1 text-sm transition-colors hover:border-secondary-foreground hover:text-secondary-foreground"
            >
              Dziś
            </button>
            <button
              type="button"
              aria-label="Następny miesiąc"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-md border px-2 py-1 text-sm transition-colors hover:border-secondary-foreground hover:text-secondary-foreground"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-2.5">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {monthGrid.map((d) => {
            const key = dayKey(d);
            const inMonth = d.getMonth() === viewMonth.getMonth();
            const isToday = key === dayKey(new Date());
            const isSelected = !!selectedDay && key === dateKey(selectedDay);
            const daySlots = slotsByDay.get(key) ?? [];
            const hasSlots = daySlots.length > 0;

            return (
              <button
                key={key}
                type="button"
                disabled={!hasSlots}
                onClick={() => {
                  setSelectedDay(daySlots[0].startsAt);
                  onDayChange?.();
                }}
                className={`flex min-h-[112px] flex-col items-start gap-1 p-2.5 text-left transition-colors ${
                  hasSlots ? "cursor-pointer hover:bg-secondary" : "cursor-default"
                } ${isSelected ? "bg-primary/10" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] ${
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                  }`}
                >
                  {d.getDate()}
                </span>
                {hasSlots && (
                  <span
                    className={`flex flex-col gap-0.5 text-[11px] ${isSelected ? "text-accent-foreground" : "text-muted-foreground"}`}
                  >
                    {daySlots.slice(0, 3).map((s) => (
                      <span key={`${s.practitionerId}|${s.startsAt}`} className="flex items-center gap-1">
                        <span className={`size-1.5 shrink-0 rounded-full ${SERVICE_TYPE_STYLES[s.serviceId].dot}`} />
                        {formatTime(s.startsAt)}
                      </span>
                    ))}
                    {daySlots.length > 3 && <span>+{daySlots.length - 3} więcej</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {visibleSlots.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Brak wolnych terminów tego dnia.
          </p>
        )}
        {visibleSlots.map((slot) => {
          const isSelected = selectedSlot?.startsAt === slot.startsAt && selectedSlot?.practitionerId === slot.practitionerId;
          return (
            <button
              type="button"
              key={`${slot.practitionerId}|${slot.startsAt}`}
              onClick={() => onSelect(slot)}
              className={`flex flex-col rounded-lg border px-3 py-2.5 text-left text-[15px] font-medium transition-colors ${
                isSelected
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-card text-secondary-foreground hover:border-secondary-foreground hover:bg-secondary"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${SERVICE_TYPE_STYLES[slot.serviceId].dot}`} />
                {formatTime(slot.startsAt)}
              </span>
              {selectedServiceType === "all" && (
                <span className="text-xs font-normal text-muted-foreground">{serviceTitleById.get(slot.serviceId)}</span>
              )}
              {selectedSpecialist === "all" && (
                <span className="text-xs font-normal text-muted-foreground">{slot.practitionerName}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

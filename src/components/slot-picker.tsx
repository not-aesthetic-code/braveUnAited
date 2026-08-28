"use client";

import { useMemo, useState } from "react";
import type { Slot } from "@/lib/appointments";

const dayKey = (d: Date) => d.toDateString();
const dateKey = (iso: string) => dayKey(new Date(iso));

const WEEKDAY_LABELS = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

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

// Month calendar + specialist filter + time-slot grid for the selected day.
// Shared by the booking flow and every reschedule flow (patient + panel) so
// picking a new time always looks and behaves the same, instead of a plain
// <select> dropdown in some places and this calendar in others.
export function SlotPicker({
  slots,
  selectedSlot,
  onSelect,
  onDayChange,
}: {
  slots: Slot[];
  selectedSlot: Slot | null;
  onSelect: (slot: Slot) => void;
  // Called when the user picks a different day — lets a caller mid-flow
  // (e.g. the booking form) drop back to browsing instead of leaving a
  // stale slot/phase selected under the newly picked day.
  onDayChange?: () => void;
}) {
  const days = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots) if (!seen.has(dateKey(s.startsAt))) seen.set(dateKey(s.startsAt), s.startsAt);
    return [...seen.values()].sort();
  }, [slots]);

  const specialists = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots) seen.set(s.practitionerId, s.practitionerName);
    return [...seen.entries()];
  }, [slots]);

  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>("all");
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(days[0] ? new Date(days[0]) : new Date())
  );

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      if (selectedSpecialist !== "all" && s.practitionerId !== selectedSpecialist) continue;
      const key = dateKey(s.startsAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(s);
      else map.set(key, [s]);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [slots, selectedSpecialist]);

  const monthGrid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const visibleSlots = slots
    .filter((s) => selectedDay && dateKey(s.startsAt) === dateKey(selectedDay))
    .filter((s) => selectedSpecialist === "all" || s.practitionerId === selectedSpecialist)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="flex flex-col gap-6">
      {/* month calendar — availability only exists within the 7-day publish
          horizon (listAvailableSlots), so most cells are simply unbookable */}
      <div className="overflow-hidden rounded-4xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-lg font-bold capitalize text-secondary-foreground">
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
            <div key={w} className="py-2">
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
                className={`flex min-h-[84px] flex-col items-start gap-1 p-2 text-left transition-colors ${
                  hasSlots ? "cursor-pointer hover:bg-secondary" : "cursor-default"
                } ${isSelected ? "bg-primary/10" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${
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
                    {daySlots.slice(0, 2).map((s) => (
                      <span key={`${s.practitionerId}|${s.startsAt}`}>{formatTime(s.startsAt)}</span>
                    ))}
                    {daySlots.length > 2 && <span>+{daySlots.length - 2} więcej</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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
              <span>{formatTime(slot.startsAt)}</span>
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

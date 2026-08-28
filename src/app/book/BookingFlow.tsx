"use client";

import { useEffect, useMemo, useReducer, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { holdSlotAction, startPaymentAction } from "./actions";
import type { Appointment, ServiceType, Slot } from "@/lib/appointments";

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

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

// ponytail: msLeft is computed fresh every render instead of cached in state —
// caching it meant the first render after a hold starts saw a stale 0 (from
// before `target` existed) and immediately tripped the expiry check.
function useCountdown(target: string | undefined) {
  const [, forceTick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!target) return;
    const id = setInterval(forceTick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return target ? Math.max(0, new Date(target).getTime() - Date.now()) : 0;
}

type Phase = "browse" | "form" | "held" | "expired";

export function BookingFlow({ slots, serviceType }: { slots: Slot[]; serviceType: ServiceType }) {
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

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [phase, setPhase] = useState<Phase>("browse");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const visibleSlots = slots
    .filter((s) => selectedDay && dateKey(s.startsAt) === dateKey(selectedDay))
    .filter((s) => selectedSpecialist === "all" || s.practitionerId === selectedSpecialist)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const msLeft = useCountdown(phase === "held" ? appt?.heldUntil : undefined);
  useEffect(() => {
    if (phase === "held" && msLeft === 0) setPhase("expired");
  }, [phase, msLeft]);

  function pickSlot(slot: Slot) {
    setSelectedSlot(slot);
    setError(null);
    setPhase("form");
  }

  function submitHold() {
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await holdSlotAction({
        practitionerId: selectedSlot.practitionerId,
        serviceType,
        startsAt: selectedSlot.startsAt,
        // ponytail: email left "" when not given — PatientContact stays a plain
        // required-string type instead of widening it for one optional field.
        patientContact: { name, phone, email },
      });
      if (result.ok) {
        setAppt(result.value);
        setPhase("held");
      } else {
        setError(result.error);
      }
    });
  }

  function pay() {
    if (!appt) return;
    setError(null);
    startTransition(async () => {
      // Redirects away (free bookings go straight to /my-booking/[id];
      // paid ones go to Stripe-hosted Checkout, which redirects back there
      // once the webhook confirms payment) — no local "confirmed" phase.
      const result = await startPaymentAction(appt.id);
      if (result.ok) {
        window.location.href = result.value.url;
      } else {
        setError(result.error);
        setPhase("expired");
      }
    });
  }

  function reset() {
    setSelectedSlot(null);
    setAppt(null);
    setError(null);
    setPhase("browse");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* month calendar — availability only exists within the 7-day publish
          horizon (listAvailableSlots), so most cells are simply unbookable */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-lg font-semibold capitalize">
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

        <div className="grid grid-cols-7 border-b text-center text-xs text-muted-foreground">
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
                  reset();
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
                  <span className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
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
            onClick={() => setSelectedSpecialist("all")}
            className={`rounded-full border px-3 py-1 text-xs ${
              selectedSpecialist === "all" ? "border-primary bg-primary/10" : "bg-card"
            }`}
          >
            Wszyscy specjaliści
          </button>
          {specialists.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setSelectedSpecialist(id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                selectedSpecialist === id ? "border-primary bg-primary/10" : "bg-card"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {phase === "browse" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visibleSlots.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">Brak wolnych terminów tego dnia.</p>
          )}
          {visibleSlots.map((slot) => (
            <button
              key={`${slot.practitionerId}|${slot.startsAt}`}
              onClick={() => pickSlot(slot)}
              className="flex flex-col rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:border-secondary-foreground hover:bg-secondary hover:text-secondary-foreground"
            >
              <span className="font-medium">{formatTime(slot.startsAt)}</span>
              {selectedSpecialist === "all" && (
                <span className="text-xs text-muted-foreground">{slot.practitionerName}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {phase === "form" && selectedSlot && (
        <div className="rounded-xl border bg-card p-5">
          <p className="font-medium">
            {selectedSlot.practitionerName} · {formatDay(selectedSlot.startsAt)}, {formatTime(selectedSlot.startsAt)}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedSlot.price > 0 ? `${selectedSlot.price} zł` : "Bezpłatnie"} · termin trzymamy 10 minut
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Imię i nazwisko"
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefon (wymagany)"
              type="tel"
              required
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail (opcjonalnie — potwierdzenie i link do spotkania)"
              type="email"
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={reset}>Wróć</Button>
            <Button disabled={!name || !phone || pending} onClick={submitHold}>
              {pending ? "Trzymam termin…" : "Zarezerwuj termin"}
            </Button>
          </div>
        </div>
      )}

      {phase === "held" && appt && selectedSlot && (
        <div className="rounded-xl border bg-card p-5">
          <p className="font-medium">
            {selectedSlot.practitionerName} · {formatDay(appt.startsAt)}, {formatTime(appt.startsAt)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Termin zarezerwowany dla Ciebie jeszcze przez{" "}
            <span className="font-semibold text-foreground">
              {Math.floor(msLeft / 60000)}:{String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0")}
            </span>
          </p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <Button className="mt-4" disabled={pending} onClick={pay}>
            {pending ? "Płacę…" : appt.price > 0 ? `Zapłać ${appt.price} zł i potwierdź` : "Potwierdź bezpłatną wizytę"}
          </Button>
        </div>
      )}

      {phase === "expired" && (
        <div className="rounded-xl border bg-card p-5 text-center">
          <p className="text-sm text-destructive">{error ?? "Czas na płatność minął — termin wrócił do puli."}</p>
          <Button className="mt-3" variant="outline" onClick={reset}>Wybierz termin ponownie</Button>
        </div>
      )}
    </div>
  );
}

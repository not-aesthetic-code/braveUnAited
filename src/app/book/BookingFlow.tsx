"use client";

import { useEffect, useMemo, useReducer, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { confirmPaymentAction, holdSlotAction } from "./actions";
import type { Appointment, ServiceType, Slot } from "@/lib/appointments";

const dateKey = (iso: string) => new Date(iso).toDateString();

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

type Phase = "browse" | "form" | "held" | "expired" | "confirmed";

export function BookingFlow({ slots, serviceType }: { slots: Slot[]; serviceType: ServiceType }) {
  const days = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots) if (!seen.has(dateKey(s.startsAt))) seen.set(dateKey(s.startsAt), s.startsAt);
    return [...seen.values()].sort();
  }, [slots]);

  const specialists = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of slots) seen.set(s.specialistId, s.specialistName);
    return [...seen.entries()];
  }, [slots]);

  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>("all");
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
    .filter((s) => selectedSpecialist === "all" || s.specialistId === selectedSpecialist)
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
        specialistId: selectedSlot.specialistId,
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
      const result = await confirmPaymentAction(appt.id);
      if (result.ok) {
        setAppt(result.value);
        setPhase("confirmed");
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

  if (phase === "confirmed" && appt) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-lg font-semibold">Wizyta zarezerwowana ✅</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedSlot?.specialistName} · {formatDay(appt.startsAt)}, {formatTime(appt.startsAt)}
        </p>
        <p className="text-sm text-muted-foreground">
          {appt.price > 0 ? `Zapłacono ${appt.price} zł` : "Bezpłatnie"}
        </p>
        <Link
          href={`/my-booking/${appt.id}`}
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          Zarządzaj rezerwacją
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* day strip — this is the "calendar" and matches the 7-day publish
          horizon in listAvailableSlots, not a full month grid */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => {
              setSelectedDay(d);
              reset();
            }}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm capitalize ${
              dateKey(d) === dateKey(selectedDay ?? d) ? "border-primary bg-primary/10" : "bg-card"
            }`}
          >
            {formatDay(d)}
          </button>
        ))}
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
              key={`${slot.specialistId}|${slot.startsAt}`}
              onClick={() => pickSlot(slot)}
              className="flex flex-col rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="font-medium">{formatTime(slot.startsAt)}</span>
              {selectedSpecialist === "all" && (
                <span className="text-xs text-muted-foreground">{slot.specialistName}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {phase === "form" && selectedSlot && (
        <div className="rounded-xl border bg-card p-5">
          <p className="font-medium">
            {selectedSlot.specialistName} · {formatDay(selectedSlot.startsAt)}, {formatTime(selectedSlot.startsAt)}
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
            {selectedSlot.specialistName} · {formatDay(appt.startsAt)}, {formatTime(appt.startsAt)}
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

"use client";

import { useEffect, useReducer, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDay, formatTime, SlotPicker } from "@/components/slot-picker";
import { holdSlotAction, startPaymentAction } from "./actions";
import type { Appointment, ServiceType, Slot } from "@/lib/appointments";

const ctaClassName = "font-bold tracking-wide uppercase";

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
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [phase, setPhase] = useState<Phase>("browse");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+48 ");
  const [email, setEmail] = useState("");

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
      <SlotPicker slots={slots} selectedSlot={selectedSlot} onSelect={pickSlot} onDayChange={reset} />

      {phase === "form" && selectedSlot && (
        <div className="rounded-4xl border border-border bg-card p-6">
          <p className="font-semibold text-secondary-foreground">
            {selectedSlot.practitionerName} · {formatDay(selectedSlot.startsAt)}, {formatTime(selectedSlot.startsAt)}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-secondary-foreground">
              {selectedSlot.price > 0 ? `${selectedSlot.price} zł` : "Bezpłatnie"}
            </span>{" "}
            · termin trzymamy 10 minut
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="booking-name">Imię i nazwisko</FieldLabel>
              <Input id="booking-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
            </Field>
            <Field>
              <FieldLabel htmlFor="booking-phone">Telefon (wymagany)</FieldLabel>
              {/* +48 is a fixed prefix, not part of the value — every patient
                  is calling from Poland (see lib/phone.ts), so there's nothing
                  to pick here. */}
              <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-base focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30">
                <span className="text-muted-foreground">+48</span>
                <Input
                  id="booking-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="numeric"
                  required
                  className="h-auto border-0 p-0 focus-visible:ring-0"
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="booking-email">E-mail (opcjonalnie)</FieldLabel>
              <Input
                id="booking-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="potwierdzenie i link do spotkania"
                className="h-10"
              />
            </Field>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={reset}>Wróć</Button>
            <Button className={ctaClassName} disabled={!name || !phone || pending} onClick={submitHold}>
              {pending ? "Trzymam termin…" : "Zarezerwuj termin"}
            </Button>
          </div>
        </div>
      )}

      {phase === "held" && appt && selectedSlot && (
        <div className="rounded-4xl border border-border bg-card p-6">
          <p className="font-semibold text-secondary-foreground">
            {selectedSlot.practitionerName} · {formatDay(appt.startsAt)}, {formatTime(appt.startsAt)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Termin zarezerwowany dla Ciebie jeszcze przez{" "}
            <span className="rounded-full bg-accent px-2 py-0.5 font-bold tabular-nums text-accent-foreground">
              {Math.floor(msLeft / 60000)}:{String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0")}
            </span>
          </p>
          {error && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <Button className={`mt-5 ${ctaClassName}`} disabled={pending} onClick={pay}>
            {pending ? "Płacę…" : appt.price > 0 ? `Zapłać ${appt.price} zł i potwierdź` : "Potwierdź bezpłatną wizytę"}
          </Button>
        </div>
      )}

      {phase === "expired" && (
        <div className="rounded-4xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-destructive">{error ?? "Czas na płatność minął — termin wrócił do puli."}</p>
          <Button className="mt-4" variant="outline" onClick={reset}>Wybierz termin ponownie</Button>
        </div>
      )}
    </div>
  );
}

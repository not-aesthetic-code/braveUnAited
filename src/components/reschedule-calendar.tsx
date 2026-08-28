"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDay, formatTime, SlotPicker } from "@/components/slot-picker";
import type { Slot } from "@/lib/appointments";

// The reschedule counterpart to BookingFlow's calendar: same SlotPicker, just
// wired to submit a single "newStartsAt" field instead of running the full
// hold → pay flow. Shared by the patient flow (/my-booking) and the
// practitioner panel — the panel passes skipSpecialistStep since the
// specialist there is already fixed to whoever's logged in.
export function RescheduleCalendar({
  slots,
  action,
  skipSpecialistStep,
}: {
  slots: Slot[];
  action: (formData: FormData) => void | Promise<void>;
  skipSpecialistStep?: boolean;
}) {
  const [selected, setSelected] = useState<Slot | null>(null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <SlotPicker
        slots={slots}
        selectedSlot={selected}
        onSelect={setSelected}
        onDayChange={() => setSelected(null)}
        skipSpecialistStep={skipSpecialistStep}
      />
      <input type="hidden" name="newStartsAt" value={selected?.startsAt ?? ""} />
      <Button type="submit" variant="outline" disabled={!selected}>
        {selected
          ? `Zapisz nowy termin: ${formatDay(selected.startsAt)}, ${formatTime(selected.startsAt)}`
          : "Wybierz nowy termin"}
      </Button>
    </form>
  );
}

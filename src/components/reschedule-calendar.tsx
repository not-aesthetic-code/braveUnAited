"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDay, formatTime, SlotPicker } from "@/components/slot-picker";
import type { Slot } from "@/lib/appointments";

// The reschedule counterpart to BookingFlow's calendar: same SlotPicker, just
// wired to submit a single "newStartsAt" field instead of running the full
// hold → pay flow. Patient-facing only (/my-booking) — the practitioner
// reschedule flow uses the simpler PractitionerRescheduleTimes instead, since
// there's no need to browse months or pick a specialist there.
export function RescheduleCalendar({
  slots,
  action,
}: {
  slots: Slot[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<Slot | null>(null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <SlotPicker slots={slots} selectedSlot={selected} onSelect={setSelected} onDayChange={() => setSelected(null)} />
      <input type="hidden" name="newStartsAt" value={selected?.startsAt ?? ""} />
      <Button type="submit" variant="outline" disabled={!selected}>
        {selected
          ? `Zapisz nowy termin: ${formatDay(selected.startsAt)}, ${formatTime(selected.startsAt)}`
          : "Wybierz nowy termin"}
      </Button>
    </form>
  );
}

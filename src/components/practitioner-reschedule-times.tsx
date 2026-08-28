"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDay, formatTime } from "@/components/slot-picker";
import type { Slot } from "@/lib/appointments";

// Practitioner reschedule needs neither RescheduleCalendar's month browsing
// nor its specialist column — the practitioner is already fixed and slots
// never span more than the 7-day publish horizon — so a flat per-day list of
// times fits the narrow appointment card instead of clipping.
export function PractitionerRescheduleTimes({
  slots,
  action,
}: {
  slots: Slot[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<Slot | null>(null);

  const byDay = new Map<string, Slot[]>();
  for (const s of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = formatDay(s.startsAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(s);
    else byDay.set(key, [s]);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {byDay.size === 0 && <p className="text-sm text-muted-foreground">Brak wolnych terminów.</p>}
      {[...byDay.entries()].map(([day, daySlots]) => (
        <div key={day} className="flex flex-wrap items-center gap-2">
          <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground capitalize">{day}</span>
          {daySlots.map((slot) => (
            <button
              type="button"
              key={slot.startsAt}
              onClick={() => setSelected(slot)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selected?.startsAt === slot.startsAt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary text-primary hover:bg-primary/5"
              }`}
            >
              {formatTime(slot.startsAt)}
            </button>
          ))}
        </div>
      ))}
      <input type="hidden" name="newStartsAt" value={selected?.startsAt ?? ""} />
      <Button type="submit" variant="outline" size="sm" disabled={!selected}>
        {selected
          ? `Zapisz nowy termin: ${formatDay(selected.startsAt)}, ${formatTime(selected.startsAt)}`
          : "Wybierz nowy termin"}
      </Button>
    </form>
  );
}

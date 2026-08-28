"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ManagedAvailabilityService,
  PanelVisit,
  Service,
  StoredHourOverride,
  WeeklyAvailabilityRange,
} from "@/lib/appointments";
import { timeToMinutes, validateWeeklyRanges } from "@/lib/therapist-calendar";
import { saveWeeklyAvailabilityAction } from "./actions";
import { HourOverridesGrid } from "./hour-overrides-grid";

// UI is Monday-first; dayOfWeek matches the DB (0=Sunday..6=Saturday).
const DAYS = [
  { label: "Poniedziałek", dayOfWeek: 1 },
  { label: "Wtorek", dayOfWeek: 2 },
  { label: "Środa", dayOfWeek: 3 },
  { label: "Czwartek", dayOfWeek: 4 },
  { label: "Piątek", dayOfWeek: 5 },
  { label: "Sobota", dayOfWeek: 6 },
  { label: "Niedziela", dayOfWeek: 0 },
] as const;

const SERVICE_TAB_LABEL: Record<ManagedAvailabilityService, string> = {
  pelnoplatna: "Konsultacje pełnopłatne",
  niskoplatna: "Konsultacje niskopłatne",
};

// Soft floor, informational only — the mockup has no blocking error state
// for this on either tab. See docs/dostepnosc/01-tygodniowy-rytm.md.
const COMMUNITY_MINIMUM_MINUTES = 300;

type EditableRange = { localId: string; dayOfWeek: number; startTime: string; endTime: string };

function toEditable(ranges: WeeklyAvailabilityRange[]): EditableRange[] {
  return ranges.map((r) => ({
    localId: crypto.randomUUID(),
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
  }));
}

// therapist-calendar.ts uses 1=Monday..7=Sunday.
function toIsoWeekday(dayOfWeek: number): number {
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function slotsPerWeek(ranges: EditableRange[], stepMinutes: number): number {
  if (stepMinutes <= 0) return 0;
  return ranges.reduce((total, r) => {
    const start = timeToMinutes(r.startTime);
    const end = timeToMinutes(r.endTime);
    return start === null || end === null || end <= start
      ? total
      : total + Math.floor((end - start) / stepMinutes);
  }, 0);
}

function totalMinutes(ranges: EditableRange[]): number {
  return ranges.reduce((total, r) => {
    const start = timeToMinutes(r.startTime);
    const end = timeToMinutes(r.endTime);
    return start === null || end === null || end <= start ? total : total + (end - start);
  }, 0);
}

export function WeeklyRhythmEditor({
  initialAvailability,
  services,
  lowCostVisitsThisWeek,
  lowCostVisitsLimit,
  hourGrid,
}: {
  initialAvailability: Record<ManagedAvailabilityService, WeeklyAvailabilityRange[]>;
  services: Record<ManagedAvailabilityService, Service>;
  lowCostVisitsThisWeek: number;
  lowCostVisitsLimit: number;
  // Step 2 of the same screen. It lives inside these tabs rather than beside
  // them because the two services keep genuinely separate schedules — a
  // second tab strip would let you read one service's rhythm against the
  // other service's grid.
  hourGrid: {
    fromDate: string;
    overrides: Record<ManagedAvailabilityService, StoredHourOverride[]>;
    visits: PanelVisit[];
  };
}) {
  const [activeTab, setActiveTab] = useState<ManagedAvailabilityService>("pelnoplatna");
  const [ranges, setRanges] = useState<Record<ManagedAvailabilityService, EditableRange[]>>({
    pelnoplatna: toEditable(initialAvailability.pelnoplatna),
    niskoplatna: toEditable(initialAvailability.niskoplatna),
  });
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateService(serviceId: ManagedAvailabilityService, next: EditableRange[]) {
    setRanges((prev) => ({ ...prev, [serviceId]: next }));
  }

  function handleSave() {
    setMessage(null);

    for (const serviceId of ["pelnoplatna", "niskoplatna"] as const) {
      const result = validateWeeklyRanges(
        ranges[serviceId].map((r) => ({
          weekday: toIsoWeekday(r.dayOfWeek),
          startTime: r.startTime,
          endTime: r.endTime,
        }))
      );
      if (!result.ok) {
        setActiveTab(serviceId);
        setMessage({ kind: "error", text: `${SERVICE_TAB_LABEL[serviceId]}: ${result.error}` });
        return;
      }
    }

    startTransition(async () => {
      const result = await saveWeeklyAvailabilityAction({
        pelnoplatna: ranges.pelnoplatna.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
        niskoplatna: ranges.niskoplatna.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
      });
      setMessage(
        result.ok ? { kind: "success", text: "Zapisano harmonogram." } : { kind: "error", text: result.error }
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Zapisywanie…" : "Zapisz harmonogram"}
        </Button>
      </div>

      {message && (
        <p className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-primary"}`}>
          {message.text}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ManagedAvailabilityService)}>
        <TabsList>
          <TabsTrigger value="pelnoplatna">{SERVICE_TAB_LABEL.pelnoplatna}</TabsTrigger>
          <TabsTrigger value="niskoplatna">{SERVICE_TAB_LABEL.niskoplatna}</TabsTrigger>
        </TabsList>

        {(["pelnoplatna", "niskoplatna"] as const).map((serviceId) => (
          <TabsContent key={serviceId} value={serviceId} className="mt-4">
            <div className="flex flex-col gap-6">
              {serviceId === "niskoplatna" && (
                <LowCostQuotaCard used={lowCostVisitsThisWeek} limit={lowCostVisitsLimit} />
              )}
              <ServiceScheduleCard
                service={services[serviceId]}
                ranges={ranges[serviceId]}
                onChange={(next) => updateService(serviceId, next)}
                showCommunityMinimumWarning={serviceId === "niskoplatna"}
              />
              <HourOverridesGrid
                serviceId={serviceId}
                initialWeek={hourGrid}
                rhythm={ranges[serviceId]}
                otherServices={(["pelnoplatna", "niskoplatna"] as const)
                  .filter((other) => other !== serviceId)
                  .map((other) => ({
                    serviceId: other,
                    label: SERVICE_TAB_LABEL[other],
                    // The live editor state, not the saved rows: the warning
                    // has to judge the schedule the practitioner is looking
                    // at right now.
                    rhythm: ranges[other],
                  }))}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function LowCostQuotaCard({ used, limit }: { used: number; limit: number }) {
  const remaining = Math.max(limit - used, 0);
  const percent = Math.min((used / limit) * 100, 100);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight">Twoja pula na ten tydzień</h2>
          <p className="text-sm text-muted-foreground">
            Możesz przyjąć maksymalnie {limit} {limit === 1 ? "wizytę" : "wizyt"} niskopłatnych tygodniowo
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          {used} z {limit}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>

      <p className="text-sm text-muted-foreground">
        Zostały {remaining} {remaining === 1 ? "wizyta" : "wizyt"}. Pula odnawia się w każdy poniedziałek.
      </p>
    </div>
  );
}

function ServiceScheduleCard({
  service,
  ranges,
  onChange,
  showCommunityMinimumWarning,
}: {
  service: Service;
  ranges: EditableRange[];
  onChange: (next: EditableRange[]) => void;
  showCommunityMinimumWarning: boolean;
}) {
  const stepMinutes = service.durationMinutes + service.bufferMinutes;
  const weeklySlots = useMemo(() => slotsPerWeek(ranges, stepMinutes), [ranges, stepMinutes]);
  const minutes = useMemo(() => totalMinutes(ranges), [ranges]);

  function rangesForDay(dayOfWeek: number) {
    return ranges.filter((r) => r.dayOfWeek === dayOfWeek);
  }

  function toggleDay(dayOfWeek: number, on: boolean) {
    if (on) {
      onChange([...ranges, { localId: crypto.randomUUID(), dayOfWeek, startTime: "09:00", endTime: "17:00" }]);
    } else {
      onChange(ranges.filter((r) => r.dayOfWeek !== dayOfWeek));
    }
  }

  // New range starts where the day's last one ends, so it doesn't
  // immediately fail the overlap check.
  function addRange(dayOfWeek: number) {
    const lastEnd = rangesForDay(dayOfWeek).reduce((max, r) => {
      const end = timeToMinutes(r.endTime);
      return end !== null && end > max ? end : max;
    }, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const toHm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    const start = Math.min(lastEnd, 22 * 60);
    const end = Math.min(start + 60, 23 * 60 + 59);
    onChange([...ranges, { localId: crypto.randomUUID(), dayOfWeek, startTime: toHm(start), endTime: toHm(end) }]);
  }

  function updateRange(localId: string, patch: Partial<Pick<EditableRange, "startTime" | "endTime">>) {
    onChange(ranges.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  function removeRange(localId: string) {
    onChange(ranges.filter((r) => r.localId !== localId));
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight">1. Tygodniowy rytm</h2>
          <p className="text-sm text-muted-foreground">
            Ustaw raz, a system pokroi zakres na wizyty po {service.durationMinutes} minut
            {service.bufferMinutes > 0 ? ` z ${service.bufferMinutes}-minutową przerwą.` : "."}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {weeklySlots} {weeklySlots === 1 ? "termin" : "terminów"} tygodniowo
        </span>
      </div>

      {showCommunityMinimumWarning && minutes < COMMUNITY_MINIMUM_MINUTES && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Otwarte godziny to {(minutes / 60).toFixed(1)} h tygodniowo — fundacja prosi o co najmniej{" "}
          {COMMUNITY_MINIMUM_MINUTES / 60} h dla wizyt niskopłatnych.
        </p>
      )}

      <div className="flex flex-col divide-y">
        {DAYS.map((day) => {
          const dayRanges = rangesForDay(day.dayOfWeek);
          const isOn = dayRanges.length > 0;
          return (
            <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Switch
                checked={isOn}
                onCheckedChange={(checked) => toggleDay(day.dayOfWeek, checked)}
                aria-label={`${day.label} — dostępność`}
              />
              <span className={`w-28 shrink-0 ${isOn ? "font-medium" : "text-muted-foreground"}`}>{day.label}</span>

              {!isOn && <span className="text-sm text-muted-foreground">Nie przyjmujesz w ten dzień.</span>}

              {isOn && (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {dayRanges.map((range) => (
                    <div key={range.localId} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={range.startTime}
                        onChange={(e) => updateRange(range.localId, { startTime: e.target.value })}
                        className="w-28"
                        aria-label={`${day.label} — godzina rozpoczęcia`}
                      />
                      <span className="text-sm text-muted-foreground">do</span>
                      <Input
                        type="time"
                        value={range.endTime}
                        onChange={(e) => updateRange(range.localId, { endTime: e.target.value })}
                        className="w-28"
                        aria-label={`${day.label} — godzina zakończenia`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRange(range.localId)}
                        aria-label="Usuń zakres"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => addRange(day.dayOfWeek)}>
                    <Plus className="size-4" />
                    Zakres
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

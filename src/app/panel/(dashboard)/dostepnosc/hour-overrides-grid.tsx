"use client";

import { useMemo, useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ManagedAvailabilityService, StoredHourOverride, WeeklyAvailabilityRange } from "@/lib/appointments";
import { buildHourGrid, gridDates, gridHours, nextOverride, type HourCellState } from "@/lib/therapist-calendar";
import { cn } from "@/lib/utils";
import { toggleHourOverrideAction } from "./hour-overrides-actions";

const SERVICE_TAB_LABEL: Record<ManagedAvailabilityService, string> = {
  pelnoplatna: "Konsultacje pełnopłatne",
  niskoplatna: "Konsultacje niskopłatne",
};

const SHORT_DAYS = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];

const CELL_STYLE: Record<HourCellState, string> = {
  rhythm: "bg-primary/15 border-primary/40 hover:bg-primary/25",
  added: "bg-secondary border-secondary-foreground/50 hover:bg-secondary/80",
  removed: "border-dashed bg-muted text-muted-foreground hover:bg-muted/70",
  booked: "bg-secondary-foreground/15 border-secondary-foreground/30 cursor-not-allowed",
  empty: "bg-card hover:bg-secondary/50",
};

const CELL_LABEL: Record<HourCellState, string> = {
  rhythm: "z rytmu tygodniowego — kliknij, aby wyłączyć",
  added: "dodana ręcznie — kliknij, aby cofnąć",
  removed: "wyłączona — kliknij, aby przywrócić",
  booked: "zajęta przez pacjenta",
  empty: "wolna — kliknij, aby otworzyć",
};

type Props = {
  fromDate: string;
  availability: Record<ManagedAvailabilityService, WeeklyAvailabilityRange[]>;
  overrides: Record<ManagedAvailabilityService, StoredHourOverride[]>;
  booked: { date: string; startHour: number; endHour: number }[];
};

export function HourOverridesGrid({ fromDate, availability, overrides, booked }: Props) {
  const [activeTab, setActiveTab] = useState<ManagedAvailabilityService>("pelnoplatna");
  const [state, setState] = useState(overrides);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(serviceId: ManagedAvailabilityService, date: string, hour: number, cellState: HourCellState) {
    const intent = nextOverride(cellState);
    if (!intent) return;
    setError(null);

    // Optimistic: the grid is a click-heavy surface and a round trip per
    // cell would make it feel broken. A failed write rolls back to exactly
    // the list we had before this click.
    const previous = state;
    const withoutCell = state[serviceId].filter((item) => !(item.date === date && item.hour === hour));
    setState({
      ...state,
      [serviceId]: intent === "clear" ? withoutCell : [...withoutCell, { date, hour, kind: intent }],
    });

    startTransition(async () => {
      const result = await toggleHourOverrideAction({ serviceId, date, hour, intent });
      if (!result.ok) {
        setState(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ManagedAvailabilityService)}>
        <TabsList>
          <TabsTrigger value="pelnoplatna">{SERVICE_TAB_LABEL.pelnoplatna}</TabsTrigger>
          <TabsTrigger value="niskoplatna">{SERVICE_TAB_LABEL.niskoplatna}</TabsTrigger>
        </TabsList>

        {(["pelnoplatna", "niskoplatna"] as const).map((serviceId) => (
          <TabsContent key={serviceId} value={serviceId} className="mt-4">
            <ServiceGrid
              fromDate={fromDate}
              rhythm={availability[serviceId]}
              overrides={state[serviceId]}
              booked={booked}
              onToggle={(date, hour, cellState) => toggle(serviceId, date, hour, cellState)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ServiceGrid({
  fromDate,
  rhythm,
  overrides,
  booked,
  onToggle,
}: {
  fromDate: string;
  rhythm: WeeklyAvailabilityRange[];
  overrides: StoredHourOverride[];
  booked: { date: string; startHour: number; endHour: number }[];
  onToggle: (date: string, hour: number, state: HourCellState) => void;
}) {
  const dates = useMemo(() => gridDates(fromDate), [fromDate]);
  const hours = gridHours();
  const cells = useMemo(
    () => buildHourGrid({ from: fromDate, rhythm, overrides, booked }),
    [fromDate, rhythm, overrides, booked],
  );
  const stateAt = (date: string, hour: number) =>
    cells.find((cell) => cell.date === date && cell.hour === hour)?.state ?? "empty";

  const added = overrides.filter((item) => item.kind === "open").length;
  const removed = overrides.filter((item) => item.kind === "closed").length;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight">2. Poprawki na konkretnych godzinach</h2>
          <p className="text-sm text-muted-foreground">
            Rytm powyżej wypełnia siatkę automatycznie. Tutaj klikasz pojedyncze godziny: wyłączasz te, których nie
            chcesz, i dokładasz takie, których w rytmie nie ma.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            +{added} dodanych
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            −{removed} wyłączonych
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Legend className="border-primary/40 bg-primary/15">z rytmu tygodniowego</Legend>
        <Legend className="border-secondary-foreground/50 bg-secondary">dodana ręcznie</Legend>
        <Legend className="border-dashed bg-muted">wyłączona</Legend>
        <Legend className="border-secondary-foreground/30 bg-secondary-foreground/15">zajęta przez pacjenta</Legend>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[620px] gap-1"
          style={{ gridTemplateColumns: "56px repeat(7, minmax(40px, 1fr))" }}
        >
          <div />
          {dates.map((date) => (
            <div key={date} className="pb-1.5 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">
                {SHORT_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}
              </div>
              <div className="text-xs font-medium">{Number(date.slice(8, 10))}</div>
            </div>
          ))}

          {hours.map((hour) => (
            <HourRow key={hour} hour={hour} dates={dates} stateAt={stateAt} onToggle={onToggle} />
          ))}
        </div>
      </div>

      <p className="rounded-lg border-l-2 border-secondary-foreground bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
        <strong className="block text-secondary-foreground">Poprawki są jednorazowe</strong>
        Wyłączenie godziny dotyczy tylko tego konkretnego dnia. Jeśli chcesz zmienić coś na stałe, popraw rytm
        tygodniowy powyżej — inaczej za tydzień wróci to samo. Siatka pokazuje 7 dni, bo tylko na tyle wolno wystawiać
        terminy.
      </p>
    </div>
  );
}

function HourRow({
  hour,
  dates,
  stateAt,
  onToggle,
}: {
  hour: number;
  dates: string[];
  stateAt: (date: string, hour: number) => HourCellState;
  onToggle: (date: string, hour: number, state: HourCellState) => void;
}) {
  const label = `${String(hour).padStart(2, "0")}:00`;
  return (
    <>
      <div className="flex items-center justify-end pr-1.5 text-xs tabular-nums text-muted-foreground">{label}</div>
      {dates.map((date) => {
        const state = stateAt(date, hour);
        return (
          <button
            key={`${date}-${hour}`}
            type="button"
            disabled={state === "booked"}
            onClick={() => onToggle(date, hour, state)}
            title={CELL_LABEL[state]}
            className={cn(
              "h-8 rounded-md border transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
              CELL_STYLE[state],
            )}
          >
            <span className="sr-only">
              {date} {label} — {CELL_LABEL[state]}
            </span>
          </button>
        );
      })}
    </>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i className={cn("inline-block size-3 rounded-[3px] border", className)} />
      {children}
    </span>
  );
}

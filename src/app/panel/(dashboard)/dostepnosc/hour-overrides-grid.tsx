"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ManagedAvailabilityService,
  PanelVisit,
  StoredHourOverride,
  WeeklyAvailabilityRange,
} from "@/lib/appointments";
import {
  buildHourGrid,
  gridDates,
  gridHours,
  hourBoundsFor,
  nextOverride,
  type HourCellState,
} from "@/lib/therapist-calendar";
import { cn } from "@/lib/utils";
import { toggleHourOverrideAction } from "./hour-overrides-actions";

const SERVICE_TAB_LABEL: Record<ManagedAvailabilityService, string> = {
  pelnoplatna: "Konsultacje pełnopłatne",
  niskoplatna: "Konsultacje niskopłatne",
};

const SHORT_DAYS = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];
const ROW_HEIGHT = "2.5rem";

// One colour per service type, because the grid mixes them: a booked block
// has to say *which* kind of visit it is at a glance, not just "zajęte".
const VISIT_STYLE: Record<string, { block: string; dot: string; short: string }> = {
  niskoplatna: { block: "border-emerald-600/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200", dot: "bg-emerald-600", short: "Niskopłatna" },
  pelnoplatna: { block: "border-indigo-600/40 bg-indigo-500/15 text-indigo-900 dark:text-indigo-200", dot: "bg-indigo-600", short: "Pełnopłatna" },
  adhd_diagnoza: { block: "border-amber-600/40 bg-amber-500/20 text-amber-900 dark:text-amber-200", dot: "bg-amber-600", short: "Diagnoza ADHD" },
  bezplatna: { block: "border-teal-600/40 bg-teal-500/15 text-teal-900 dark:text-teal-200", dot: "bg-teal-600", short: "Bezpłatna" },
  asystent_zdrowienia: { block: "border-slate-500/40 bg-slate-500/15 text-slate-900 dark:text-slate-200", dot: "bg-slate-500", short: "Asystent" },
};

const FALLBACK_VISIT_STYLE = { block: "border-border bg-muted text-foreground", dot: "bg-muted-foreground", short: "Wizyta" };
const visitStyle = (serviceId: string) => VISIT_STYLE[serviceId] ?? FALLBACK_VISIT_STYLE;

const CELL_STYLE: Record<Exclude<HourCellState, "booked">, string> = {
  rhythm: "bg-primary/15 border-primary/40 hover:bg-primary/25",
  added: "bg-secondary border-secondary-foreground/50 hover:bg-secondary/80",
  removed: "border-dashed bg-muted text-muted-foreground hover:bg-muted/70",
  empty: "bg-card hover:bg-secondary/50",
};

const CELL_LABEL: Record<HourCellState, string> = {
  rhythm: "z rytmu tygodniowego — kliknij, aby wyłączyć",
  added: "dodana ręcznie — kliknij, aby cofnąć",
  removed: "wyłączona — kliknij, aby przywrócić",
  booked: "zajęta przez pacjenta",
  empty: "wolna — kliknij, aby otworzyć",
};

const STATUS_LABEL: Record<string, string> = {
  held: "Czeka na płatność",
  confirmed: "Potwierdzona",
  completed: "Odbyta",
  no_show: "Pacjent się nie zjawił",
  cancelled: "Anulowana",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Oczekuje",
  paid: "Opłacona",
  refund_due: "Zwrot do wykonania",
  refunded: "Zwrócona",
};

type Props = {
  fromDate: string;
  availability: Record<ManagedAvailabilityService, WeeklyAvailabilityRange[]>;
  overrides: Record<ManagedAvailabilityService, StoredHourOverride[]>;
  visits: PanelVisit[];
};

export function HourOverridesGrid({ fromDate, availability, overrides, visits }: Props) {
  const [activeTab, setActiveTab] = useState<ManagedAvailabilityService>("pelnoplatna");
  const [state, setState] = useState(overrides);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PanelVisit | null>(null);
  const [, startTransition] = useTransition();

  function toggle(serviceId: ManagedAvailabilityService, date: string, hour: number, cellState: HourCellState) {
    const intent = nextOverride(cellState);
    if (!intent) return;
    setError(null);

    // Optimistic: the grid is a click-heavy surface and a round trip per cell
    // would make it feel broken. A failed write rolls back to exactly the
    // list we had before this click.
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
              visits={visits}
              onToggle={(date, hour, cellState) => toggle(serviceId, date, hour, cellState)}
              onOpenVisit={setSelected}
            />
          </TabsContent>
        ))}
      </Tabs>

      <VisitDialog visit={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ServiceGrid({
  fromDate,
  rhythm,
  overrides,
  visits,
  onToggle,
  onOpenVisit,
}: {
  fromDate: string;
  rhythm: WeeklyAvailabilityRange[];
  overrides: StoredHourOverride[];
  visits: PanelVisit[];
  onToggle: (date: string, hour: number, state: HourCellState) => void;
  onOpenVisit: (visit: PanelVisit) => void;
}) {
  const dates = useMemo(() => gridDates(fromDate), [fromDate]);
  // Rows follow the data: open 06:00 in the rhythm above and a 06:00 row
  // appears here as soon as the schedule is saved.
  const bounds = useMemo(
    () => hourBoundsFor({ rhythm, overrides, visits }),
    [rhythm, overrides, visits],
  );
  const hours = useMemo(() => gridHours(bounds), [bounds]);

  // Clamped to the visible window so a 07:00 or 21:00 visit still renders as
  // a block at the edge instead of escaping the grid.
  const placed = useMemo(
    () =>
      visits
        .map((visit) => ({
          visit,
          dayIndex: dates.indexOf(visit.date),
          fromHour: Math.max(visit.startHour, bounds.first),
          toHour: Math.min(visit.endHour, bounds.last + 1),
        }))
        .filter((item) => item.dayIndex >= 0 && item.toHour > item.fromHour),
    [visits, dates, bounds],
  );

  const covered = useMemo(() => {
    const set = new Set<string>();
    for (const item of placed) {
      for (let hour = item.fromHour; hour < item.toHour; hour += 1) set.add(`${item.visit.date}-${hour}`);
    }
    return set;
  }, [placed]);

  const cells = useMemo(
    () =>
      buildHourGrid({
        from: fromDate,
        rhythm,
        overrides,
        booked: visits.map(({ date, startHour, endHour }) => ({ date, startHour, endHour })),
        bounds,
      }),
    [fromDate, rhythm, overrides, visits, bounds],
  );

  const added = overrides.filter((item) => item.kind === "open").length;
  const removed = overrides.filter((item) => item.kind === "closed").length;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight">2. Poprawki na konkretnych godzinach</h2>
          <p className="text-sm text-muted-foreground">
            Rytm powyżej wypełnia siatkę automatycznie. Tutaj klikasz pojedyncze godziny: wyłączasz te, których nie
            chcesz, i dokładasz takie, których w rytmie nie ma. Kliknij zarezerwowaną wizytę, aby zobaczyć pacjenta.
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

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <Legend className="border-primary/40 bg-primary/15">z rytmu tygodniowego</Legend>
        <Legend className="border-secondary-foreground/50 bg-secondary">dodana ręcznie</Legend>
        <Legend className="border-dashed bg-muted">wyłączona</Legend>
        {Object.entries(VISIT_STYLE).map(([serviceId, style]) => (
          <Legend key={serviceId} className={cn("border-transparent", style.dot)}>
            {style.short}
          </Legend>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[700px] gap-1"
          style={{
            gridTemplateColumns: "56px repeat(7, minmax(72px, 1fr))",
            gridTemplateRows: `auto repeat(${hours.length}, ${ROW_HEIGHT})`,
          }}
        >
          {dates.map((date, dayIndex) => (
            <div
              key={date}
              className="pb-1.5 text-center"
              style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
            >
              <div className="text-[10px] uppercase text-muted-foreground">
                {SHORT_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}
              </div>
              <div className="text-xs font-medium">{Number(date.slice(8, 10))}</div>
            </div>
          ))}

          {hours.map((hour, hourIndex) => (
            <div
              key={`label-${hour}`}
              className="flex items-center justify-end pr-1.5 text-xs tabular-nums text-muted-foreground"
              style={{ gridColumn: 1, gridRow: hourIndex + 2 }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}

          {dates.flatMap((date, dayIndex) =>
            hours
              .map((hour, hourIndex) => ({ hour, hourIndex }))
              .filter(({ hour }) => !covered.has(`${date}-${hour}`))
              .map(({ hour, hourIndex }) => {
                const state = (cells.find((cell) => cell.date === date && cell.hour === hour)?.state ??
                  "empty") as Exclude<HourCellState, "booked">;
                return (
                  <button
                    key={`${date}-${hour}`}
                    type="button"
                    onClick={() => onToggle(date, hour, state)}
                    title={CELL_LABEL[state]}
                    style={{ gridColumn: dayIndex + 2, gridRow: hourIndex + 2 }}
                    className={cn(
                      "rounded-md border transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      CELL_STYLE[state],
                    )}
                  >
                    <span className="sr-only">
                      {date} {String(hour).padStart(2, "0")}:00 — {CELL_LABEL[state]}
                    </span>
                  </button>
                );
              }),
          )}

          {placed.map(({ visit, dayIndex, fromHour, toHour }) => {
            const style = visitStyle(visit.serviceId);
            // A 50-minute visit only gets one row — there is no space for the
            // service line, so the colour carries the type and the tooltip
            // spells it out.
            const compact = toHour - fromHour < 2;
            return (
              <button
                key={visit.id}
                type="button"
                onClick={() => onOpenVisit(visit)}
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: `${fromHour - bounds.first + 2} / span ${toHour - fromHour}`,
                }}
                title={`${style.short} · ${visit.patient.name} · ${visit.startLabel}–${visit.endLabel}`}
                className={cn(
                  "flex flex-col items-start justify-center overflow-hidden rounded-md border px-1.5 text-left leading-[1.15] transition-colors hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  compact ? "gap-0 py-0.5" : "gap-0.5 py-1",
                  style.block,
                )}
              >
                <span className="w-full truncate text-[10px] font-semibold tabular-nums">
                  {visit.startLabel}–{visit.endLabel}
                </span>
                {!compact && <span className="w-full truncate text-[10px] font-medium">{style.short}</span>}
                <span className="w-full truncate text-[10px] opacity-80">{visit.patient.name}</span>
              </button>
            );
          })}
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

// Hand-rolled rather than @/components/ui/dialog: that wrapper is currently
// unused anywhere in the app and its Base UI portal does not mount when the
// dialog is driven by an `open` prop, so a click produced no visible panel.
function VisitDialog({ visit, onClose }: { visit: PanelVisit | null; onClose: () => void }) {
  useEffect(() => {
    if (!visit) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visit, onClose]);

  if (!visit) return null;

  const dayLabel = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${visit.date}T12:00:00Z`));

  return (
    <div
      role="presentation"
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-[2px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="relative w-full max-w-sm rounded-xl border bg-card p-5 shadow-lg"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>

        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Profil pacjenta</p>
        <h3 id="visit-dialog-title" className="mt-1 text-lg font-bold tracking-tight">
          {visit.patient.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {dayLabel}, {visit.startLabel}–{visit.endLabel}
        </p>

        <dl className="mt-4 flex flex-col text-sm">
          <Row label="Rodzaj wizyty">
            <span className="inline-flex items-center gap-2">
              <i className={cn("inline-block size-2.5 rounded-full", visitStyle(visit.serviceId).dot)} />
              {visit.serviceTitle}
            </span>
          </Row>
          <Row label="Czas trwania">{visit.durationMinutes} minut</Row>
          <Row label="Status">{STATUS_LABEL[visit.status] ?? visit.status}</Row>
          <Row label="Płatność">
            {PAYMENT_LABEL[visit.paymentStatus] ?? visit.paymentStatus} · {visit.price} zł
          </Row>
          <Row label="E-mail">{visit.patient.email || "—"}</Row>
          <Row label="Telefon">{visit.patient.phone}</Row>
        </dl>

        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Panel pokazuje wyłącznie dane kontaktowe i przebieg wizyty. Notatki z sesji i dokumentacja terapeutyczna mają
          osobny reżim dostępu i nie trafiają na ten ekran.
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
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

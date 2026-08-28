"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  BASE_SERVICE_TYPES,
  GRANTABLE_SERVICE_TYPES,
  type ManagedServiceCard,
  type ServiceType,
  type WeeklyAvailabilityRange,
} from "@/lib/appointments";
import { setPelnoplatnaRateAction, setServiceAcceptingAction } from "./actions";

// The two base services keep hours on /panel/dostepnosc — that screen
// doesn't manage the grantable ones yet, so "Ustaw godziny" only links out
// for these two. See docs/dostepnosc/00-przeglad.md.
const HOURS_SCREEN_SERVICES: readonly ServiceType[] = BASE_SERVICE_TYPES;

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first display order
const DAY_LABEL: Record<number, string> = { 0: "nie", 1: "pon", 2: "wt", 3: "śr", 4: "czw", 5: "pt", 6: "sob" };

const LOCKED_NOTE: Partial<Record<ServiceType, string>> = {
  asystent_zdrowienia: "Asystentami zdrowienia zostają osoby z własnym doświadczeniem kryzysu, po szkoleniu fundacji.",
};
const LOCKED_NOTE_FALLBACK = "Ta usługa wymaga zgody koordynatora fundacji.";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "godzina" : "godzin"} tygodniowo`;
}

// Groups ranges that share the exact same start/end into one line
// ("wt, czw · 9:00–13:00"), one line per distinct time range.
function groupHours(ranges: WeeklyAvailabilityRange[]): { days: number[]; startTime: string; endTime: string }[] {
  const byRange = new Map<string, { days: number[]; startTime: string; endTime: string }>();
  for (const r of ranges) {
    const key = `${r.startTime}-${r.endTime}`;
    const existing = byRange.get(key);
    if (existing) existing.days.push(r.dayOfWeek);
    else byRange.set(key, { days: [r.dayOfWeek], startTime: r.startTime, endTime: r.endTime });
  }
  return [...byRange.values()]
    .map((g) => ({ ...g, days: [...g.days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)) }))
    .sort((a, b) => DAY_ORDER.indexOf(a.days[0]) - DAY_ORDER.indexOf(b.days[0]));
}

export function EnabledServiceCards({
  cards,
  pelnoplatnaRateOptions,
}: {
  cards: ManagedServiceCard[];
  pelnoplatnaRateOptions: readonly number[];
}) {
  const byId = new Map(cards.map((c) => [c.service.id, c]));

  const mainList = [
    ...BASE_SERVICE_TYPES.map((id) => byId.get(id)!),
    ...GRANTABLE_SERVICE_TYPES.map((id) => byId.get(id)!).filter((c) => c.hasGrant),
  ];
  const lockedList = GRANTABLE_SERVICE_TYPES.map((id) => byId.get(id)!).filter((c) => !c.hasGrant);

  return (
    <div className="flex flex-col gap-4">
      {mainList.map((card) => (
        <ServiceCard key={card.service.id} card={card} pelnoplatnaRateOptions={pelnoplatnaRateOptions} />
      ))}

      {lockedList.length > 0 && (
        <>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">Wymaga zgody fundacji</h2>
          {lockedList.map((card) => (
            <LockedServiceCard key={card.service.id} card={card} />
          ))}
        </>
      )}
    </div>
  );
}

function ServiceCard({
  card,
  pelnoplatnaRateOptions,
}: {
  card: ManagedServiceCard;
  pelnoplatnaRateOptions: readonly number[];
}) {
  const { service } = card;
  const [isAccepting, setIsAccepting] = useState(card.isAccepting);
  const [priceOverride, setPriceOverride] = useState(card.priceOverride);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAcceptingChange(next: boolean) {
    setError(null);
    setIsAccepting(next);
    startTransition(async () => {
      const result = await setServiceAcceptingAction(service.id, next);
      if (!result.ok) {
        setIsAccepting(!next);
        setError(result.error);
      }
    });
  }

  function handleRateChange(rate: number) {
    setError(null);
    const previous = priceOverride;
    setPriceOverride(rate);
    startTransition(async () => {
      const result = await setPelnoplatnaRateAction(rate);
      if (!result.ok) {
        setPriceOverride(previous);
        setError(result.error);
      }
    });
  }

  const groups = groupHours(card.hours);
  const totalMinutes = card.hours.reduce((sum, r) => sum + (timeToMinutes(r.endTime) - timeToMinutes(r.startTime)), 0);
  const showsHoursLink = HOURS_SCREEN_SERVICES.includes(service.id);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight text-primary">{service.title}</h2>
          <p className="text-sm text-muted-foreground">{service.description}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2">
          <Switch checked={isAccepting} onCheckedChange={handleAcceptingChange} disabled={isPending} />
          <span className="text-sm font-medium">Przyjmuję</span>
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
        <div>
          <p className="text-sm font-medium">Czas trwania</p>
          <div className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm">{service.durationMinutes} minut</div>
          <p className="mt-1 text-xs text-muted-foreground">🔒 ustala fundacja</p>
        </div>

        <div>
          <p className="text-sm font-medium">Cena</p>
          {service.id === "pelnoplatna" ? (
            <>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {pelnoplatnaRateOptions.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRateChange(rate)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      priceOverride === rate
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    {rate} zł
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Twoja stawka</p>
            </>
          ) : (
            <>
              <div className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm">
                {service.basePrice === 0 ? "Bezpłatnie" : `${service.basePrice} zł`}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">🔒 ustala fundacja</p>
            </>
          )}
        </div>

        <div>
          <p className="text-sm font-medium">Forma</p>
          <div className="mt-1 flex gap-1.5">
            {(["online", "stacjonarnie"] as const).map((mode) => (
              <span
                key={mode}
                className={`rounded-full border px-3 py-1 text-sm ${
                  service.locationMode === mode
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {mode === "online" ? "Online" : "Stacjonarnie"}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Godziny przyjęć</p>
          {groups.length === 0 ? (
            <>
              <p className="font-medium">brak godzin</p>
              <p className="text-sm text-muted-foreground">usługa nie pojawi się w wyszukiwarce</p>
            </>
          ) : (
            <>
              {groups.map((g) => (
                <p key={`${g.startTime}-${g.endTime}`} className="font-medium">
                  {g.days.map((d) => DAY_LABEL[d]).join(", ")} · {g.startTime}–{g.endTime}
                </p>
              ))}
              <p className="text-sm text-muted-foreground">{formatHours(totalMinutes)}</p>
            </>
          )}
        </div>

        {showsHoursLink ? (
          <Link href="/panel/dostepnosc" className={buttonVariants({ variant: "outline" })}>
            Ustaw godziny
          </Link>
        ) : (
          <Button variant="outline" disabled title="Wkrótce dostępne">
            Ustaw godziny
          </Button>
        )}
      </div>
    </div>
  );
}

function LockedServiceCard({ card }: { card: ManagedServiceCard }) {
  const { service } = card;
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 opacity-90">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold tracking-tight text-primary">{service.title}</h2>
          <p className="text-sm text-muted-foreground">{service.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
          Brak uprawnienia
        </span>
      </div>
      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
        {LOCKED_NOTE[service.id] ?? LOCKED_NOTE_FALLBACK}
      </p>
    </div>
  );
}

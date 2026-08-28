import type { ServiceType } from "./appointments";

export const WARSAW_TIME_ZONE = "Europe/Warsaw";
export const REQUIRED_COMMUNITY_MINUTES = 300;

export type CommunityServiceType = Extract<ServiceType, "niskoplatna" | "bezplatna">;

export type WeeklyAvailabilityInput = {
  weekday: number;
  startTime: string;
  endTime: string;
  serviceType: CommunityServiceType;
};

export type AvailabilityExceptionInput = {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
};

export type ValidationResult =
  | { ok: true; minutes: number }
  | { ok: false; minutes: number; error: string };

export type ExceptionValidationResult = { ok: true } | { ok: false; error: string };

export type MonthDay = { date: string; inCurrentMonth: boolean };

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function timeToMinutes(value: string): number | null {
  if (!TIME_RE.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function minutesOfEligibleAvailability(ranges: WeeklyAvailabilityInput[]): number {
  return ranges.reduce((total, range) => {
    const start = timeToMinutes(range.startTime);
    const end = timeToMinutes(range.endTime);
    return start === null || end === null || end <= start ? total : total + end - start;
  }, 0);
}

export function validateWeeklyAvailability(ranges: WeeklyAvailabilityInput[]): ValidationResult {
  for (const range of ranges) {
    if (!Number.isInteger(range.weekday) || range.weekday < 1 || range.weekday > 7) {
      return { ok: false, minutes: 0, error: "Wybierz poprawny dzień tygodnia." };
    }
    if (range.serviceType !== "niskoplatna" && range.serviceType !== "bezplatna") {
      return { ok: false, minutes: 0, error: "Wybierz wizytę 55 zł albo Darmową." };
    }
    const start = timeToMinutes(range.startTime);
    const end = timeToMinutes(range.endTime);
    if (start === null || end === null || end <= start) {
      return { ok: false, minutes: 0, error: "Godzina zakończenia musi być późniejsza niż rozpoczęcia." };
    }
  }

  const sorted = [...ranges].sort((a, b) =>
    a.weekday === b.weekday
      ? a.startTime.localeCompare(b.startTime)
      : a.weekday - b.weekday,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.weekday !== current.weekday) continue;
    const previousStart = timeToMinutes(previous.startTime)!;
    const previousEnd = timeToMinutes(previous.endTime)!;
    const currentStart = timeToMinutes(current.startTime)!;
    const currentEnd = timeToMinutes(current.endTime)!;
    if (rangesOverlap(previousStart, previousEnd, currentStart, currentEnd)) {
      return { ok: false, minutes: minutesOfEligibleAvailability(ranges), error: "Godziny w tym samym dniu nie mogą na siebie nachodzić." };
    }
  }

  const minutes = minutesOfEligibleAvailability(ranges);
  if (minutes < REQUIRED_COMMUNITY_MINUTES) {
    return { ok: false, minutes, error: "Ustaw co najmniej 5 godzin tygodniowo dla wizyt 55 zł lub Darmowych." };
  }
  return { ok: true, minutes };
}

export function validateAvailabilityException(
  input: AvailabilityExceptionInput,
  existing: AvailabilityExceptionInput[],
): ExceptionValidationResult {
  if (!DATE_RE.test(input.date)) return { ok: false, error: "Wybierz poprawną datę." };
  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  if (start === null || end === null || end <= start) {
    return { ok: false, error: "Godzina zakończenia musi być późniejsza niż rozpoczęcia." };
  }
  const hasOverlap = existing.some((item) => {
    if (item.date !== input.date) return false;
    const itemStart = timeToMinutes(item.startTime);
    const itemEnd = timeToMinutes(item.endTime);
    return itemStart !== null && itemEnd !== null && rangesOverlap(start, end, itemStart, itemEnd);
  });
  return hasOverlap
    ? { ok: false, error: "Nieobecność nachodzi na istniejącą blokadę." }
    : { ok: true };
}

function datePartsInWarsaw(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: value("weekday"),
  };
}

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function startOfWarsawWeek(date: Date): string {
  const warsaw = datePartsInWarsaw(date);
  const weekdayIndex: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return addUtcDays(warsaw.date, -(weekdayIndex[warsaw.weekday] ?? 0));
}

export function warsawWallTimeToIso(date: string, time: string): string {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) throw new Error("Invalid Warsaw wall time");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: WARSAW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = desiredWallClock;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
    const renderedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    instant = desiredWallClock - (renderedAsUtc - instant);
  }
  return new Date(instant).toISOString();
}

export function buildMonthDays(anchor: string): MonthDay[] {
  if (!DATE_RE.test(anchor)) throw new Error("Invalid calendar anchor date");
  const [year, month] = anchor.split("-").map(Number);
  const monthStart = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const start = startOfWarsawWeek(new Date(`${monthStart}T12:00:00Z`));
  return Array.from({ length: 42 }, (_, index) => {
    const date = addUtcDays(start, index);
    return { date, inCurrentMonth: date.slice(0, 7) === monthStart.slice(0, 7) };
  });
}

// --- Hour-correction grid -------------------------------------------------
// The mockup's "Poprawki na konkretnych godzinach" grid: 7 days x whole
// hours, each cell showing where that hour comes from. Kept pure so the cell
// states are testable without a browser or a database.

export const GRID_FIRST_HOUR = 8;
export const GRID_LAST_HOUR = 19;
export const GRID_DAYS = 7;

export type HourCellState = "empty" | "rhythm" | "added" | "disabled" | "busy" | "absence";

export type HourCorrection = {
  id: string;
  date: string;
  startTime: string;
  kind: "open" | "closed";
  serviceType: CommunityServiceType;
};

export type BusyBlock = { date: string; startHour: number; endHour: number };

export type HourCell = { date: string; hour: number; state: HourCellState };

export function gridHours(): number[] {
  return Array.from({ length: GRID_LAST_HOUR - GRID_FIRST_HOUR + 1 }, (_, i) => GRID_FIRST_HOUR + i);
}

export function gridDates(from: string): string[] {
  if (!DATE_RE.test(from)) throw new Error("Invalid grid start date");
  return Array.from({ length: GRID_DAYS }, (_, index) => addUtcDays(from, index));
}

export function weekdayOf(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function buildHourGrid(input: {
  from: string;
  serviceType: CommunityServiceType;
  rhythm: WeeklyAvailabilityInput[];
  corrections: HourCorrection[];
  absences: AvailabilityExceptionInput[];
  busy: BusyBlock[];
}): HourCell[] {
  const hours = gridHours();
  return gridDates(input.from).flatMap((date) => {
    const weekday = weekdayOf(date);
    return hours.map((hour) => {
      const cellStart = hour * 60;
      const cellEnd = cellStart + 60;
      const covers = (start: string, end: string) => {
        const from = timeToMinutes(start);
        const to = timeToMinutes(end);
        return from !== null && to !== null && rangesOverlap(from, to, cellStart, cellEnd);
      };

      // Order matters: a booked visit outranks every editable state, and a
      // holiday outranks the rhythm the same way it does on the server.
      if (input.busy.some((block) => block.date === date && block.startHour < hour + 1 && hour < block.endHour)) {
        return { date, hour, state: "busy" as const };
      }
      if (input.absences.some((item) => item.date === date && covers(item.startTime, item.endTime))) {
        return { date, hour, state: "absence" as const };
      }

      const correction = input.corrections.find(
        (item) =>
          item.date === date &&
          item.serviceType === input.serviceType &&
          timeToMinutes(item.startTime) === cellStart,
      );
      if (correction) return { date, hour, state: correction.kind === "open" ? ("added" as const) : ("disabled" as const) };

      const inRhythm = input.rhythm.some(
        (range) =>
          range.weekday === weekday &&
          range.serviceType === input.serviceType &&
          covers(range.startTime, range.endTime),
      );
      return { date, hour, state: inRhythm ? ("rhythm" as const) : ("empty" as const) };
    });
  });
}

// What a click on a cell should do. Returning the intent (rather than
// mutating) keeps the decision in one tested place shared by UI and server.
export function nextCorrection(state: HourCellState): "open" | "closed" | "clear" | null {
  if (state === "rhythm") return "closed";
  if (state === "empty") return "open";
  if (state === "added" || state === "disabled") return "clear";
  return null;
}

export function countWeeklySlots(ranges: WeeklyAvailabilityInput[], stepMinutes = 60): number {
  return ranges.reduce((total, range) => {
    const start = timeToMinutes(range.startTime);
    const end = timeToMinutes(range.endTime);
    if (start === null || end === null || end <= start) return total;
    return total + Math.floor((end - start) / stepMinutes);
  }, 0);
}

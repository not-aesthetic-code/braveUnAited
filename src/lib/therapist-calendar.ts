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

export function timeToMinutes(value: string): number | null {
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

export type WeeklyRangeInput = { weekday: number; startTime: string; endTime: string };

// Same weekday/ordering/overlap checks as validateWeeklyAvailability, minus
// the niskopłatna-only service-type gate and the 300-min community floor —
// used for the pełnopłatna tab, which has neither rule. (The mockup shows no
// minimum-hours error state for either tab, so the floor is a soft warning
// rendered from minutesOfEligibleAvailability, not a blocking check here.)
export function validateWeeklyRanges(ranges: WeeklyRangeInput[]): ExceptionValidationResult {
  for (const range of ranges) {
    if (!Number.isInteger(range.weekday) || range.weekday < 1 || range.weekday > 7) {
      return { ok: false, error: "Wybierz poprawny dzień tygodnia." };
    }
    const start = timeToMinutes(range.startTime);
    const end = timeToMinutes(range.endTime);
    if (start === null || end === null || end <= start) {
      return { ok: false, error: "Godzina zakończenia musi być późniejsza niż rozpoczęcia." };
    }
  }

  const sorted = [...ranges].sort((a, b) =>
    a.weekday === b.weekday ? a.startTime.localeCompare(b.startTime) : a.weekday - b.weekday,
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
      return { ok: false, error: "Godziny w tym samym dniu nie mogą na siebie nachodzić." };
    }
  }

  return { ok: true };
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

// --- Hour override grid ---------------------------------------------------
// The mockup's "Poprawki na konkretnych godzinach": 7 days x whole hours,
// each cell labelled with where that hour comes from. Pure, so the cell
// states stay testable without a browser or a database.
//
// Conventions here follow the rest of the panel rather than this file's own
// older helpers: `dayOfWeek` is 0=Sunday..6=Saturday (the DB check
// constraint, and what WeeklyAvailabilityRange already carries), and the
// service is the plain `service_id` string the availability rows are scoped
// by. That keeps the grid free of back-and-forth weekday conversions.

// Fallback window only — the real one follows whatever the practitioner has
// actually set. Someone who opens 06:00 must see a 06:00 row, otherwise the
// rhythm they just saved is invisible here.
export const DEFAULT_FIRST_HOUR = 8;
export const DEFAULT_LAST_HOUR = 19;
// 7 days exactly, because MAX_SLOT_DAYS_AHEAD is 7 — a practitioner cannot
// publish availability further out than the grid can show.
export const GRID_DAYS = 7;

export type HourCellState = "empty" | "rhythm" | "added" | "removed" | "booked";

export type RhythmRange = { dayOfWeek: number; startTime: string; endTime: string };

export type HourOverride = {
  date: string;
  hour: number;
  kind: "open" | "closed";
};

/** A booked visit, already reduced to the whole hours it covers. */
export type BookedBlock = { date: string; startHour: number; endHour: number };

export type HourCell = { date: string; hour: number; state: HourCellState };

export type HourBounds = { first: number; last: number };

/**
 * The hour rows the grid has to draw: the default window widened to cover
 * every range, override and booked visit it is being asked to show. Without
 * this the grid silently swallows anything outside 08:00-19:00.
 */
export function hourBoundsFor(input: {
  rhythm: RhythmRange[];
  overrides: HourOverride[];
  visits: { startHour: number; endHour: number }[];
}): HourBounds {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;

  const widen = (from: number, to: number) => {
    if (Number.isFinite(from)) first = Math.min(first, Math.max(0, from));
    if (Number.isFinite(to)) last = Math.max(last, Math.min(23, to));
  };

  for (const range of input.rhythm) {
    const start = timeToMinutes(range.startTime);
    const end = timeToMinutes(range.endTime);
    if (start === null || end === null || end <= start) continue;
    // `end` is exclusive: a range ending at 17:00 fills the 16:00 row, not 17:00.
    widen(Math.floor(start / 60), Math.ceil(end / 60) - 1);
  }
  for (const override of input.overrides) widen(override.hour, override.hour);
  for (const visit of input.visits) widen(visit.startHour, visit.endHour - 1);

  return { first, last };
}

export function gridHours(bounds: HourBounds = { first: DEFAULT_FIRST_HOUR, last: DEFAULT_LAST_HOUR }): number[] {
  return Array.from({ length: bounds.last - bounds.first + 1 }, (_, i) => bounds.first + i);
}

export function gridDates(from: string): string[] {
  if (!DATE_RE.test(from)) throw new Error("Invalid grid start date");
  return Array.from({ length: GRID_DAYS }, (_, index) => addUtcDays(from, index));
}

/** 0=Sunday..6=Saturday, matching calendar_availability.day_of_week. */
export function dayOfWeekOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function buildHourGrid(input: {
  from: string;
  rhythm: RhythmRange[];
  overrides: HourOverride[];
  booked: BookedBlock[];
  bounds?: HourBounds;
}): HourCell[] {
  const hours = gridHours(input.bounds);
  return gridDates(input.from).flatMap((date) => {
    const dayOfWeek = dayOfWeekOf(date);
    return hours.map((hour): HourCell => {
      const cellStart = hour * 60;
      const cellEnd = cellStart + 60;

      // A booked visit outranks every editable state: the practitioner
      // cannot close an hour a patient already holds.
      if (input.booked.some((block) => block.date === date && block.startHour < hour + 1 && hour < block.endHour)) {
        return { date, hour, state: "booked" };
      }

      const override = input.overrides.find((item) => item.date === date && item.hour === hour);
      if (override) return { date, hour, state: override.kind === "open" ? "added" : "removed" };

      const inRhythm = input.rhythm.some((range) => {
        if (range.dayOfWeek !== dayOfWeek) return false;
        const start = timeToMinutes(range.startTime);
        const end = timeToMinutes(range.endTime);
        return start !== null && end !== null && rangesOverlap(start, end, cellStart, cellEnd);
      });
      return { date, hour, state: inRhythm ? "rhythm" : "empty" };
    });
  });
}

/**
 * What a click on a cell should do. Returning the intent rather than
 * mutating keeps the decision in one tested place, shared by the grid and
 * the server action that writes the row.
 */
export function nextOverride(state: HourCellState): "open" | "closed" | "clear" | null {
  if (state === "rhythm") return "closed";
  if (state === "empty") return "open";
  if (state === "added" || state === "removed") return "clear";
  return null;
}

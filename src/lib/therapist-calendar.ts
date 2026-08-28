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

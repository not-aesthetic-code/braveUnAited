import assert from "node:assert/strict";
import {
  buildHourGrid,
  buildMonthDays,
  countWeeklySlots,
  gridDates,
  gridHours,
  minutesOfEligibleAvailability,
  nextCorrection,
  startOfWarsawWeek,
  warsawWallTimeToIso,
  validateAvailabilityException,
  validateWeeklyAvailability,
  weekdayOf,
  type AvailabilityExceptionInput,
  type WeeklyAvailabilityInput,
} from "./therapist-calendar";

const mixedFiveHours: WeeklyAvailabilityInput[] = [
  { weekday: 1, startTime: "09:00", endTime: "11:00", serviceType: "niskoplatna" },
  { weekday: 3, startTime: "12:00", endTime: "15:00", serviceType: "bezplatna" },
];

assert.equal(minutesOfEligibleAvailability(mixedFiveHours), 300);
assert.deepEqual(validateWeeklyAvailability(mixedFiveHours), { ok: true, minutes: 300 });

const belowMinimum: WeeklyAvailabilityInput[] = [
  { weekday: 2, startTime: "09:00", endTime: "13:59", serviceType: "niskoplatna" },
];
assert.equal(validateWeeklyAvailability(belowMinimum).ok, false);

const overlapping: WeeklyAvailabilityInput[] = [
  { weekday: 4, startTime: "09:00", endTime: "12:00", serviceType: "niskoplatna" },
  { weekday: 4, startTime: "11:30", endTime: "14:00", serviceType: "bezplatna" },
];
assert.equal(validateWeeklyAvailability(overlapping).ok, false);

const backwards: WeeklyAvailabilityInput[] = [
  { weekday: 5, startTime: "12:00", endTime: "09:00", serviceType: "bezplatna" },
];
assert.equal(validateWeeklyAvailability(backwards).ok, false);

const existingExceptions: AvailabilityExceptionInput[] = [
  { date: "2026-09-14", startTime: "10:00", endTime: "12:00", reason: "Szkolenie" },
];
assert.equal(
  validateAvailabilityException(
    { date: "2026-09-14", startTime: "11:00", endTime: "13:00", reason: "" },
    existingExceptions,
  ).ok,
  false,
);
assert.deepEqual(
  validateAvailabilityException(
    { date: "2026-09-15", startTime: "09:00", endTime: "10:00", reason: "Urlop" },
    existingExceptions,
  ),
  { ok: true },
);

assert.equal(startOfWarsawWeek(new Date("2026-08-28T18:00:00Z")), "2026-08-24");
assert.equal(startOfWarsawWeek(new Date("2026-03-29T01:30:00Z")), "2026-03-23");
assert.equal(warsawWallTimeToIso("2026-09-14", "10:00"), "2026-09-14T08:00:00.000Z");
assert.equal(warsawWallTimeToIso("2026-11-14", "10:00"), "2026-11-14T09:00:00.000Z");

const august = buildMonthDays("2026-08-15");
assert.equal(august.length, 42);
assert.equal(august[0]?.date, "2026-07-27");
assert.equal(august[5]?.date, "2026-08-01");
assert.equal(august[41]?.date, "2026-09-06");
assert.equal(august[5]?.inCurrentMonth, true);
assert.equal(august[0]?.inCurrentMonth, false);

// --- hour grid ---
const gridRhythm = [
  { weekday: 1, startTime: "09:00", endTime: "11:00", serviceType: "niskoplatna" as const },
  { weekday: 1, startTime: "12:00", endTime: "13:00", serviceType: "bezplatna" as const },
];
const grid = buildHourGrid({
  from: "2026-08-31", // a Monday
  serviceType: "niskoplatna",
  rhythm: gridRhythm,
  corrections: [
    { id: "c1", date: "2026-08-31", startTime: "10:00", kind: "closed", serviceType: "niskoplatna" },
    { id: "c2", date: "2026-08-31", startTime: "15:00", kind: "open", serviceType: "niskoplatna" },
    { id: "c3", date: "2026-08-31", startTime: "16:00", kind: "open", serviceType: "bezplatna" },
  ],
  absences: [{ date: "2026-09-01", startTime: "09:00", endTime: "12:00" }],
  busy: [{ date: "2026-08-31", startHour: 13, endHour: 14 }],
});
const stateAt = (date: string, hour: number) =>
  grid.find((cell) => cell.date === date && cell.hour === hour)?.state;

assert.equal(grid.length, 7 * gridHours().length);
assert.equal(stateAt("2026-08-31", 9), "rhythm");
assert.equal(stateAt("2026-08-31", 10), "disabled", "a closed correction beats the rhythm");
assert.equal(stateAt("2026-08-31", 12), "empty", "the free-consultation range belongs to the other tab");
assert.equal(stateAt("2026-08-31", 13), "busy");
assert.equal(stateAt("2026-08-31", 15), "added");
assert.equal(stateAt("2026-08-31", 16), "empty", "another service's correction must not leak into this tab");
assert.equal(stateAt("2026-09-01", 9), "absence", "a holiday outranks everything editable");
assert.equal(stateAt("2026-09-02", 9), "empty", "the rhythm only repeats on its own weekday");

assert.equal(nextCorrection("rhythm"), "closed");
assert.equal(nextCorrection("empty"), "open");
assert.equal(nextCorrection("added"), "clear");
assert.equal(nextCorrection("disabled"), "clear");
assert.equal(nextCorrection("busy"), null, "a booked hour is not editable from the grid");
assert.equal(nextCorrection("absence"), null);

assert.deepEqual(gridDates("2026-08-31").slice(0, 3), ["2026-08-31", "2026-09-01", "2026-09-02"]);
assert.equal(weekdayOf("2026-08-30"), 7, "Sunday is 7, not 0");
assert.equal(countWeeklySlots(gridRhythm), 3, "two hours plus one, at one visit per hour");

console.log("therapist calendar self-check passed");

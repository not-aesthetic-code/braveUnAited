import assert from "node:assert/strict";
import {
  buildMonthDays,
  minutesOfEligibleAvailability,
  startOfWarsawWeek,
  validateAvailabilityException,
  validateWeeklyAvailability,
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

const august = buildMonthDays("2026-08-15");
assert.equal(august.length, 42);
assert.equal(august[0]?.date, "2026-07-27");
assert.equal(august[5]?.date, "2026-08-01");
assert.equal(august[41]?.date, "2026-09-06");
assert.equal(august[5]?.inCurrentMonth, true);
assert.equal(august[0]?.inCurrentMonth, false);

console.log("therapist calendar self-check passed");

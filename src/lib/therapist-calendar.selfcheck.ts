import assert from "node:assert/strict";
import {
  buildHourGrid,
  buildMonthDays,
  dayOfWeekOf,
  gridDates,
  gridHours,
  hourBoundsFor,
  minutesOfEligibleAvailability,
  nextOverride,
  startOfWarsawWeek,
  warsawWallTimeToIso,
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
assert.equal(warsawWallTimeToIso("2026-09-14", "10:00"), "2026-09-14T08:00:00.000Z");
assert.equal(warsawWallTimeToIso("2026-11-14", "10:00"), "2026-11-14T09:00:00.000Z");

const august = buildMonthDays("2026-08-15");
assert.equal(august.length, 42);
assert.equal(august[0]?.date, "2026-07-27");
assert.equal(august[5]?.date, "2026-08-01");
assert.equal(august[41]?.date, "2026-09-06");
assert.equal(august[5]?.inCurrentMonth, true);
assert.equal(august[0]?.inCurrentMonth, false);

// --- hour override grid ---
// dayOfWeek is 0=Sunday..6=Saturday here, same as calendar_availability.
const gridRhythm = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "11:00" },
  { dayOfWeek: 3, startTime: "12:00", endTime: "13:00" },
];
const grid = buildHourGrid({
  from: "2026-08-31", // a Monday
  rhythm: gridRhythm,
  overrides: [
    { date: "2026-08-31", hour: 10, kind: "closed" },
    { date: "2026-08-31", hour: 15, kind: "open" },
  ],
  booked: [{ date: "2026-08-31", startHour: 13, endHour: 14 }],
});
const stateAt = (date: string, hour: number) =>
  grid.find((cell) => cell.date === date && cell.hour === hour)?.state;

assert.equal(grid.length, 7 * gridHours().length);
assert.equal(stateAt("2026-08-31", 9), "rhythm");
assert.equal(stateAt("2026-08-31", 10), "removed", "a closed override beats the rhythm");
assert.equal(stateAt("2026-08-31", 13), "booked", "a booked visit beats an override");
assert.equal(stateAt("2026-08-31", 15), "added");
assert.equal(stateAt("2026-09-01", 9), "empty", "the rhythm only repeats on its own weekday");
assert.equal(stateAt("2026-09-02", 12), "rhythm", "Wednesday picks the Wednesday range up");

assert.equal(nextOverride("rhythm"), "closed");
assert.equal(nextOverride("empty"), "open");
assert.equal(nextOverride("added"), "clear");
assert.equal(nextOverride("removed"), "clear");
assert.equal(nextOverride("booked"), null, "a booked hour is not editable from the grid");

assert.deepEqual(gridDates("2026-08-31").slice(0, 3), ["2026-08-31", "2026-09-01", "2026-09-02"]);
assert.equal(dayOfWeekOf("2026-08-30"), 0, "Sunday is 0, matching the DB");
assert.equal(dayOfWeekOf("2026-08-31"), 1);

// Grid rows follow the data, not a hardcoded 08:00-19:00 window.
assert.deepEqual(hourBoundsFor({ rhythm: [], overrides: [], visits: [] }), { first: 8, last: 19 });
assert.deepEqual(
  hourBoundsFor({ rhythm: [{ dayOfWeek: 1, startTime: "06:00", endTime: "17:00" }], overrides: [], visits: [] }),
  { first: 6, last: 19 },
  "an early start widens the window down to it",
);
assert.deepEqual(
  hourBoundsFor({ rhythm: [{ dayOfWeek: 1, startTime: "09:00", endTime: "22:00" }], overrides: [], visits: [] }),
  { first: 8, last: 21 },
  "an exclusive end must not add an empty trailing row",
);
assert.deepEqual(
  hourBoundsFor({ rhythm: [], overrides: [{ date: "2026-08-31", hour: 7, kind: "open" }], visits: [] }),
  { first: 7, last: 19 },
  "a manually added hour outside the rhythm still needs a row",
);
assert.deepEqual(
  hourBoundsFor({ rhythm: [], overrides: [], visits: [{ startHour: 20, endHour: 22 }] }),
  { first: 8, last: 21 },
  "a late booked visit must stay visible",
);
assert.equal(gridHours({ first: 6, last: 8 }).length, 3);
assert.deepEqual(gridHours({ first: 6, last: 8 }), [6, 7, 8]);

console.log("therapist calendar self-check passed");

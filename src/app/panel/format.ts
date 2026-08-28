import type { Appointment } from "@/lib/appointments";

export const WARSAW = "Europe/Warsaw";
export const FULL_DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
export const SHORT_DAYS = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"];

export function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: WARSAW }).format(new Date(iso));
}

export function localTime(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: WARSAW, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDayNumber(date: string) {
  return String(Number(date.slice(8, 10)));
}

export function formatShortDate(date: string) {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

export function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function appointmentClass(id: string) {
  if (id === "niskoplatna") return "visit--community";
  if (id === "bezplatna") return "visit--free";
  if (id === "pelnoplatna") return "visit--paid";
  return "visit--diagnostic";
}

export function statusLabel(status: Appointment["status"]) {
  return {
    held: "Czeka na płatność",
    confirmed: "Potwierdzona",
    completed: "Odbyta",
    no_show: "Nieobecność",
    cancelled: "Anulowana",
  }[status];
}

export function minutesLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

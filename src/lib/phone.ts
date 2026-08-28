// Polish numbers only — this is a Warsaw-based foundation's booking flow, so
// the +48 country code is hardcoded rather than detected. The UI
// (BookingFlow.tsx) shows "+48" as a fixed, non-editable prefix and only
// collects the national 9-digit number — this just tolerates however
// someone types those 9 digits (spaces, dashes, parens) and rejects anything
// that isn't exactly that, so "600 123 456" and "600-123-456" dedupe to the
// same `patients` row (appointments.ts:upsertPatientByPhone keys on phone,
// and the DB column is `unique`) instead of two.
export function normalizePolishPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  // No Polish subscriber number (mobile or geographic landline, e.g. Kraków's
  // 12-prefix) starts with 0 — the domestic trunk prefix was dropped in 2005.
  return /^[1-9]\d{8}$/.test(digits) ? `+48${digits}` : null;
}

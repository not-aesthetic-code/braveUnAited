// Split out from email.ts (which pulls in the Resend SDK) so this can be
// imported from client components — e.g. BookingFlow.tsx — without bundling
// server-only send logic into the browser.
//
// Deliberately loose (no length/TLD-list checks) — this only needs to catch
// the "clearly not an email" case (missing @, missing domain, stray spaces)
// before it reaches Resend or gets stored as a patient's contact address.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}

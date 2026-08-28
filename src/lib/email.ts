// No email provider is wired up (see CHECKLIST.md) — stub delivery by
// logging instead of sending, same "stub for now" pattern as sms.ts and
// confirmPayment() before Stripe landed.
export function sendEmail(to: string, subject: string, body: string): void {
  console.log(`[email stub] -> ${to} | ${subject}\n${body}`);
}

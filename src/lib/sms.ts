// No SMS provider is wired up (see CHECKLIST.md) — stub delivery by logging
// instead of sending, the same "stub for now" pattern this project already
// used for OTP codes and confirmPayment() before Stripe landed.
export function sendSms(phone: string, message: string): void {
  console.log(`[SMS stub] -> ${phone}: ${message}`);
}

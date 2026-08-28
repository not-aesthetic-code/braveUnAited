import { Resend } from "resend";

// No custom domain is verified with Resend yet, so this sandbox address is
// the only "from" Resend will accept until one is added and verified there.
const FROM_ADDRESS = "onboarding@resend.dev";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Falls back to the old log-only stub when RESEND_API_KEY isn't set (e.g.
// local/CI without secrets). Fire-and-forget, same as callers already expect
// (see applyCancel: notifying must not fail the caller's own action).
export function sendEmail(to: string, subject: string, body: string): void {
  if (!resend) {
    console.log(`[email stub] -> ${to} | ${subject}\n${body}`);
    return;
  }
  resend.emails.send({ from: FROM_ADDRESS, to, subject, text: body }).catch((err) => {
    console.error(`[email] failed to send to ${to}:`, err);
  });
}

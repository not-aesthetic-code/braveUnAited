// Run with: pnpm dlx tsx src/lib/sms.selfcheck.ts
// Pure function — no Supabase credentials needed, unlike the other
// selfcheck scripts in this project.
import assert from "node:assert";
import { buildConfirmationSmsText } from "./appointments";

const GSM7_SEGMENT_LIMIT = 160;
// Common Polish diacritics — their presence forces UCS-2 encoding, which
// drops the single-segment budget to 70 chars (see the comment on
// buildConfirmationSmsText).
const POLISH_DIACRITICS = /[ąćęłńóśźż]/i;
// Words the message must never contain (plan.md: "no service name, no
// health-related words") — an SMS can be read by anyone holding the phone.
const FORBIDDEN_WORDS = /adhd|diagnoz|terapi|psycholog|zdrowi/i;

{
  const text = buildConfirmationSmsText("2026-09-10T10:00:00Z", null);
  assert.ok(text.length <= GSM7_SEGMENT_LIMIT, `text too long for one segment: ${text.length} chars`);
  assert.ok(!POLISH_DIACRITICS.test(text), `text must avoid Polish diacritics: "${text}"`);
  assert.ok(!FORBIDDEN_WORDS.test(text), `text must not name the service or health topic: "${text}"`);
}

{
  const link = "https://meet.google.com/anna-kowal-ska";
  const text = buildConfirmationSmsText("2026-09-10T10:00:00Z", link);
  assert.ok(text.includes(link), "meeting link must be included when present");
  assert.ok(text.length <= GSM7_SEGMENT_LIMIT, `text with link too long for one segment: ${text.length} chars`);
  assert.ok(!POLISH_DIACRITICS.test(text), `text must avoid Polish diacritics: "${text}"`);
}

{
  const address = "ul. Krucza 24/3, 00-526 Warszawa";
  const text = buildConfirmationSmsText("2026-09-10T10:00:00Z", address);
  assert.ok(text.includes(address), "address must be included when present");
  assert.ok(text.length <= GSM7_SEGMENT_LIMIT, `text with address too long for one segment: ${text.length} chars`);
}

console.log("sms.ts (buildConfirmationSmsText) self-check passed");

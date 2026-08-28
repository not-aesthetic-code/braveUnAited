# Plan — Challenge: System rezerwacji wizyt

Scope decision for the 8h day. Don't build the whole booking system — build one
vertical slice end to end. See CONTRIBUTING.md for roles/rhythm; this is *what*
we build, not *how* we work together.

Source of truth: `zakres-wdrozenia.pdf` (70p, full flow/rule spec) and
`jak-dziala-system.pdf` (60p, the clickable-mockup companion) — more precise
than the one-paragraph challenge brief. This doc distills what's relevant to
our slice; where they conflict, the rules below win over the brief.

## Status

Already built and pushed: landing page (5 service-type cards), `/book` (lists
real generated slots with per-slot pricing, no booking action yet),
`src/lib/appointments.ts` (hold/cancel/reschedule rules, corrected pricing,
2h minimum lead time, variable slot duration + buffer — all below are
implemented, not just planned).

**Next up, in order:**
1. Booking action on `/book` — contact form → hold countdown timer → stub
   payment → confirmation screen showing the video link/address immediately.
   This is Track A's actual remaining gap.
2. `/my-booking/[token]` — cancel/reschedule UI. The logic already exists in
   `appointments.ts`; this is UI-only work.
3. (Stretch, Track B) Waitlist auto-offer on specialist cancellation.

## Fixed business rules (corrected against the source docs)

- Slot hold: **10 minutes**, released automatically if payment isn't completed
- **Minimum lead time: 2 hours** from now — enforced in `holdSlot`/`listAvailableSlots`
- Free cancellation window: **24h** before appointment start — refund is
  **binary** (100% or 0%, never partial)
- No-show: **0% refund**, slot does not return to the pool
- **Specialist/coordinator-initiated cancellation always refunds 100%**,
  regardless of timing — and that hour is excluded from the specialist's
  payroll (not modeled — no payroll in our slice)
- Reschedule: max **2** times per booking, same 24h gate
- Low-pay (niskopłatna) visit: max **10 total per patient** (the docs flag an
  internal inconsistency with an older "4" figure — 10 is the shipped value).
  **Not enforced in our model** — booking is guest/token-based with no
  cross-visit patient identity, so a lifetime counter has nothing to attach
  to. Out of scope; would need a real account system first.
- Supply-side cap (4 low-pay slots/week/specialist) is enforced when a
  specialist builds their own schedule — irrelevant to our search/booking slice
- Session length: **50 min** regular, **90 min ADHD diagnoza**, **10-min
  buffer** between appointments — implemented in `listAvailableSlots`
- Specialists publish availability at most **7 days out** — implemented
- Pełnopłatna has **no single price** — each specialist picks one of four
  fixed rates: **115/125/135/145 zł**. Modeled as a fixed rate per specialist
  in `SPECIALISTS`; no rate-picker UI needed for the demo.
- ADHD diagnoza is **350 zł** (the challenge brief's "750 zł" is wrong)
- SMS: no service name, no health-related words, character-limited (segment
  cost) — relevant only once we send real notifications; stub for now
- Refunds are always **manual** — UI must say "zwrot do wykonania", never
  "zwrot wykonany" (`paymentStatus: "refund_due"` already matches this)
- No patient account/login — guest booking by default, account created
  silently after payment, login via magic link. No visit packages — every
  visit is its own reservation/payment.

## Screen inventory from the docs (for context — we're building a slice, not all of this)

- **Patient:** `/` → `/szukaj` → `/psycholog/:slug` → `/rezerwacja` →
  `/potwierdzenie`, then `/konto/wizyty`, `/konto/grupy`, `/konto/wiadomosci`,
  `/konto/dane`
- **Specialist:** `/panel` (dashboard), `/panel/wizyty` (3 tabs),
  `/panel/kalendarze`, `/panel/dostepnosc`, `/panel/rozliczenia`,
  `/panel/wydarzenia`, `/panel/wiadomosci`
- **Coordinator:** team schedule (3 views), first-contact queue + qualification,
  waitlist, bookings, patient records, specialist invoices, append-only
  decision log, grantor report

Our routes (`/`, `/book`, upcoming `/my-booking/[token]`) are a deliberately
thin slice through the patient column only.

## Explicitly out of scope

Coordinator panel, specialist panel beyond a stretch cancel action, invoicing,
RODO/compliance work, first-contact intake queue, decision log, and enforcing
the 10-visit lifetime low-pay cap (needs a real patient-identity model we
don't have by design).

## Data model (shared — implemented in `src/lib/appointments.ts`)

```ts
type ServiceType = "niskoplatna" | "pelnoplatna" | "adhd_diagnoza" | "asystent_zdrowienia" | "bezplatna";

type Appointment = {
  id: string;
  specialistId: string;
  serviceType: ServiceType;
  startsAt: string;       // ISO
  status: "held" | "confirmed" | "cancelled" | "completed" | "no_show";
  heldUntil?: string;     // ISO, set when status = "held"
  patientContact: { name: string; email: string; phone: string };
  price: number;          // PLN — varies by specialist for pełnopłatna
  rescheduleCount: number; // 0, 1, 2 — block a 3rd
  paymentStatus: "pending" | "paid" | "refund_due" | "refunded";
};

type WaitlistEntry = {
  id: string;
  specialistId: string;
  serviceType: ServiceType;
  patientContact: { name: string; email: string; phone: string };
  position: number;
};
```

`WaitlistEntry` isn't implemented yet — that's Track B. Waitlist offer expiry
is **4 hours**, clock **paused 21:00–8:00** (don't page someone at 2am).

Mock data lives in-memory — no real DB needed for a demo. If time allows, swap
for a Vercel-marketplace store; don't start there.

## File ownership (one person, one folder — per CONTRIBUTING.md)

- `src/app/book/` — search + slot selection + hold + payment (Track A builder)
- `src/app/my-booking/[token]/` — cancel/reschedule view (next open piece)
- `src/app/specialist/` — appointment list + mark attendance + cancel (Track B)
- `src/lib/appointments.ts` — shared data access + business rules. **Whoever
  touches this, push immediately and say so out loud** — every screen depends on it.
- `src/lib/waitlist.ts` — auto-offer logic (Track B)

## Payment

Stripe test mode for card/BLIK. If Stripe setup isn't done by the time it's
needed, stub `confirmPayment()` to auto-succeed and keep building the real
hold/refund logic — the payment integration is not the interesting part of
this demo, the time-boxed lock and refund-boundary math are.

Baseline we're replacing: niepodzielni.com today uses a Bookero calendar
widget for search, but payment is fully manual (bank transfer or BLIK to a
personal phone number, no atomic hold), and some slots are only announced via
Instagram/Facebook stories. Our value-add is one flow with a real hold and
self-service cancel/reschedule — say this in the demo pitch.

## Demo script (what we show at the end)

1. Patient searches a niskopłatna slot, books it — slot is held for 10 min.
2. Patient pays (or stub succeeds), gets a confirmation screen with the
   video link/address shown immediately.
3. Patient opens their booking >24h out: sees cancel/reschedule + refund
   status ("zwrot do wykonania"), not a fabricated "refunded".
4. (Stretch) Specialist cancels a booking → waitlist's first person gets the
   slot automatically, with a 4h window to accept.

One clean path beats five half-built screens.

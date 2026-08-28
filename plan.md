# Plan — Challenge: System rezerwacji wizyt

Scope decision for the 8h day. Don't build the whole booking system — build one
vertical slice end to end. See CONTRIBUTING.md for roles/rhythm; this is *what*
we build, not *how* we work together.

## What we're building (in order)

**Track A — primary (patient flow):** search a slot → 10-min hold → pay →
confirm. Then manage the booking: cancel/reschedule >24h with exact refund
shown, or contact-only <24h.

**Track B — stretch, only if Track A lands by ~13:00:** specialist cancels an
appointment → freed slot auto-offered to first person on the waitlist.

Both tracks read/write the same `Appointment` record, so Track B can start any
time after the data model exists — it doesn't block on Track A's UI.

We are explicitly **not** building: coordinator panel, first-contact intake
queue, refund-execution UI, decision log. These are real parts of the system
but add a second and third data model with no shared demo payoff in 8h.

## Fixed business rules (given — do not redesign)

- Slot hold: **10 minutes**, released automatically if payment isn't completed
- Free cancellation window: **24h** before appointment start
- Reschedule: max **2** times per booking
- Low-pay (niskopłatna) visit: max **10 total per patient**, max **4/week per specialist**
- SMS: no service name, no health-related words, character-limited (segment cost)
- No patient account/login — booking is identified by contact info + a link/token

## Data model (shared — agree before writing code)

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
  price: number;          // PLN
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

Mock data lives in-memory or in a local JSON file — no real DB needed for a
demo. If time allows, swap for Vercel Postgres/KV equivalent from the
marketplace; don't start there.

## File ownership (one person, one folder — per CONTRIBUTING.md)

- `src/app/book/` — search + slot selection + hold + payment (Track A builder)
- `src/app/my-booking/[token]/` — cancel/reschedule view (Track A builder, or
  second builder once slice 1 UI exists)
- `src/app/specialist/` — appointment list + mark attendance + cancel (Track B)
- `src/lib/appointments.ts` — shared data access + the 10-min hold / 24h /
  reschedule-limit logic. **Whoever touches this, push immediately and say so
  out loud** — every screen depends on it.
- `src/lib/waitlist.ts` — auto-offer logic (Track B)

## Payment

Stripe test mode for card/BLIK. If Stripe setup isn't done by the time slice 1
needs it, stub `confirmPayment()` to auto-succeed and keep building the real
hold/refund logic — the payment integration is not the interesting part of
this demo, the time-boxed lock and refund-boundary math are.

## Demo script (what we show at the end)

1. Patient searches a niskopłatna slot, books it — slot shows as held for 10 min.
2. Patient pays, gets confirmation.
3. Patient opens their booking >24h out: sees cancel/reschedule + exact refund amount.
4. (Stretch) Specialist cancels a booking → waitlist's first person gets the slot automatically.

One clean path beats five half-built screens.

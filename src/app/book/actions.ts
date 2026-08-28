"use server";

import { headers } from "next/headers";
import {
  confirmPayment,
  getAppointment,
  holdSlot,
  SERVICE_LABELS,
  type PatientContact,
  type ServiceType,
} from "@/lib/appointments";
import { stripe } from "@/lib/stripe";

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

function toError(e: unknown): string {
  return e instanceof Error ? e.message : "Coś poszło nie tak — spróbuj ponownie";
}

export async function holdSlotAction(input: {
  specialistId: string;
  serviceType: ServiceType;
  startsAt: string;
  patientContact: PatientContact;
}): Promise<ActionResult<Awaited<ReturnType<typeof holdSlot>>>> {
  try {
    return { ok: true, value: await holdSlot(input) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// BLIK only shows up here if it's enabled for the sandbox's PLN payment
// methods (dashboard → Settings → Payment methods) — payment_method_types is
// deliberately omitted so Stripe picks eligible methods dynamically instead.
export async function startPaymentAction(
  id: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const appt = await getAppointment(id);
    if (!appt) throw new Error("appointment not found");
    if (appt.status !== "held") throw new Error("hold expired or already confirmed");

    if (appt.price === 0) {
      await confirmPayment(id);
      return { ok: true, value: { url: `/my-booking/${id}` } };
    }

    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(appt.patientContact.email ? { customer_email: appt.patientContact.email } : {}),
      line_items: [
        {
          price_data: {
            currency: "pln",
            product_data: { name: SERVICE_LABELS[appt.serviceType].title },
            unit_amount: appt.price * 100,
          },
          quantity: 1,
        },
      ],
      metadata: { appointmentId: appt.id },
      success_url: `${origin}/my-booking/${appt.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/my-booking/${appt.id}`,
    });
    if (!session.url) throw new Error("could not start payment");
    return { ok: true, value: { url: session.url } };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

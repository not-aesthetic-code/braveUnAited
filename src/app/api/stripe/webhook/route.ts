import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { confirmPayment } from "@/lib/appointments";
import { stripe } from "@/lib/stripe";

// Fulfillment lives here, not on the success page — a customer can pay and
// close the tab before the redirect back loads, and BLIK in particular can
// confirm asynchronously after the customer approves it in their banking app.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;
    if (session.payment_status !== "unpaid" && appointmentId) {
      try {
        await confirmPayment(appointmentId);
      } catch {
        // already confirmed, cancelled, or hold expired before payment landed
      }
    }
  }

  return NextResponse.json({ received: true });
}

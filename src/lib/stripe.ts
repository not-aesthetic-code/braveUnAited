import Stripe from "stripe";

// Lazy singleton — a top-level `new Stripe()` call throws at build time
// ("Neither apiKey nor config.authenticator provided") when
// STRIPE_SECRET_KEY is not yet in the environment.
let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return _stripe;
}

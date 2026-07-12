// The admin UI needs the full store, but secret-bearing fields must never be
// serialized into the browser payload. Stripe keys are env-driven server-side
// (see serverStripeEnabled), so these DB fields are redacted before the store
// is sent to the client.
import type { Store } from "./types";

export function sanitizeStoreForClient(store: Store): Store {
  return {
    ...store,
    settings: {
      ...store.settings,
      // Never ship secret material to the browser (they're encrypted at rest, but
      // still must not leave the server). Non-secret status fields (mode,
      // connected, acceptCardPayments) and the publishable key stay — the
      // Payments UI reads full status from GET /api/admin/stripe.
      stripeSecret: "",
      stripeWebhookSecret: "",
    },
  };
}

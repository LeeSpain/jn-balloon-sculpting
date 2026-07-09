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
      stripeSecret: "",
      stripePublishable: "",
    },
  };
}

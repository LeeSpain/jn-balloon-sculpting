// Single source of truth for resolving the effective Stripe configuration.
// Admin (DB) values are primary; env vars remain as a fallback/override so
// existing env-based deployments keep working. Secrets are decrypted here,
// server-side only.
import type { Store } from "./types";
import { decryptSecret } from "./crypto";
import { hasDatabase } from "./store";

export type StripeMode = "test" | "live" | "";

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  configured: boolean; // a usable sk_/pk_ pair is present
  mode: StripeMode;
  acceptCard: boolean; // the site should take real card payments right now
}

export function resolveStripeConfig(store: Store): StripeConfig {
  const s = store.settings;
  const secretKey = decryptSecret(s.stripeSecret || "") || process.env.STRIPE_SECRET_KEY || "";
  const publishableKey = s.stripePublishable || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const webhookSecret = decryptSecret(s.stripeWebhookSecret || "") || process.env.STRIPE_WEBHOOK_SECRET || "";

  const configured = secretKey.startsWith("sk_") && publishableKey.startsWith("pk_");
  const mode: StripeMode = secretKey.startsWith("sk_live")
    ? "live"
    : secretKey.startsWith("sk_test")
      ? "test"
      : "";

  // Admin toggle is primary; BOOKINGS_LIVE=true remains an env override. Either
  // way, real payments require a configured key AND a durable database.
  const wants = !!s.acceptCardPayments || process.env.BOOKINGS_LIVE === "true";
  const acceptCard = wants && configured && hasDatabase();

  return { secretKey, publishableKey, webhookSecret, configured, mode, acceptCard };
}

export function modeOfKey(secretKey: string): StripeMode {
  return secretKey.startsWith("sk_live") ? "live" : secretKey.startsWith("sk_test") ? "test" : "";
}

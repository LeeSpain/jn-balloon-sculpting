import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import { sameOrigin } from "@/lib/security";
import { encryptSecret, decryptSecret, last4 } from "@/lib/crypto";
import { resolveStripeConfig, modeOfKey } from "@/lib/stripeConfig";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";

function webhookUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return `${base}/api/stripe/webhook`;
}

// Status only — never returns secret values. Masked last-4 + booleans.
function statusPayload(store: Store) {
  const s = store.settings;
  const secret = decryptSecret(s.stripeSecret || "");
  const webhook = decryptSecret(s.stripeWebhookSecret || "");
  const cfg = resolveStripeConfig(store);
  return {
    publishable: s.stripePublishable || "",
    secretSet: !!secret,
    secretLast4: last4(secret),
    webhookSet: !!webhook,
    webhookLast4: last4(webhook),
    mode: s.stripeMode || cfg.mode || "",
    connected: !!s.stripeConnected,
    acceptCardPayments: !!s.acceptCardPayments,
    effectiveAcceptCard: cfg.acceptCard,
    configured: cfg.configured,
    usingEnvFallback: !secret && !!process.env.STRIPE_SECRET_KEY,
    webhookUrl: webhookUrl(),
  };
}

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = await getRepository().read();
  return NextResponse.json(statusPayload(store));
}

// Save keys. Any provided (non-empty) field is stored; secrets are encrypted.
// Changing a key resets connected/mode and turns OFF card payments until re-tested.
export async function PUT(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let body: { publishable?: string; secret?: string; webhookSecret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const publishable = (body.publishable ?? "").trim();
  const secret = (body.secret ?? "").trim();
  const webhookSecret = (body.webhookSecret ?? "").trim();

  if (secret && !secret.startsWith("sk_")) {
    return NextResponse.json({ error: "Secret key should start with sk_test_ or sk_live_." }, { status: 400 });
  }
  if (publishable && !publishable.startsWith("pk_")) {
    return NextResponse.json({ error: "Publishable key should start with pk_test_ or pk_live_." }, { status: 400 });
  }
  if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
    return NextResponse.json({ error: "Webhook signing secret should start with whsec_." }, { status: 400 });
  }

  const repo = getRepository();
  const store = await repo.read();
  const s = store.settings;

  if (publishable) s.stripePublishable = publishable;
  let keyChanged = false;
  if (secret) {
    s.stripeSecret = encryptSecret(secret);
    s.stripeMode = modeOfKey(secret);
    keyChanged = true;
  }
  if (webhookSecret) {
    s.stripeWebhookSecret = encryptSecret(webhookSecret);
  }
  // Changing the secret key invalidates any prior "tested" state and, for safety,
  // switches card payments off until the new key is tested again.
  if (keyChanged) {
    s.stripeConnected = false;
    s.acceptCardPayments = false;
  }

  await repo.write(store);
  return NextResponse.json(statusPayload(store));
}

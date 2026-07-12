import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { sameOrigin, clientIp } from "@/lib/security";
import { checkRateLimit } from "@/lib/rateLimit";
import { upsertContactFromOrder, isEmail } from "@/lib/crm";
import { uid } from "@/lib/ids";
import type { Enquiry } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  message: string;
  productId: string;
  source: string;
  company: string; // honeypot — real users never see or fill this
}

function clean(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }
  // Throttle abuse of this public endpoint (persists records + CRM contacts).
  if (!(await checkRateLimit(`contact:${clientIp(req)}`, 8, 10 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many messages — please try again in a few minutes." },
      { status: 429 },
    );
  }

  let raw: Partial<Body>;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: a bot that fills the hidden field is silently accepted (200) so it
  // doesn't retry, but nothing is stored.
  if (clean(raw.company, 100)) {
    return NextResponse.json({ message: "Thanks — your message has been sent." });
  }

  const body: Body = {
    name: clean(raw.name, 120),
    email: clean(raw.email, 160),
    phone: clean(raw.phone, 40),
    eventDate: clean(raw.eventDate, 10),
    message: clean(raw.message, 4000),
    productId: clean(raw.productId, 60),
    source: clean(raw.source, 80) || "Contact page",
    company: "",
  };

  if (!body.name || !body.email) {
    return NextResponse.json(
      { error: "Please add your name and email so we can reply." },
      { status: 400 },
    );
  }
  if (!isEmail(body.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json({ error: "That email doesn’t look right — please check it." }, { status: 400 });
  }
  if (!body.message || body.message.length < 2) {
    return NextResponse.json({ error: "Please add a short message so we know how to help." }, { status: 400 });
  }
  if (body.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.eventDate)) {
    return NextResponse.json({ error: "Invalid event date." }, { status: 400 });
  }

  const repo = getRepository();
  const store = await repo.read();
  const product = body.productId ? store.products.find((p) => p.id === body.productId) : undefined;
  const nowISO = new Date().toISOString();

  const enquiry: Enquiry = {
    id: uid("enq"),
    name: body.name,
    email: body.email,
    phone: body.phone,
    eventDate: body.eventDate,
    message: body.message,
    productId: product?.id,
    productName: product?.name,
    source: body.source,
    status: "New",
    createdAt: nowISO,
  };
  if (!store.enquiries) store.enquiries = [];
  store.enquiries.unshift(enquiry);

  // Feed the same CRM records that orders do, so an enquirer becomes a contact.
  upsertContactFromOrder(store, {
    name: body.name,
    rawContact: body.email || body.phone,
    postcode: "",
    source: "Website enquiry",
    status: "New enquiry",
    consent: false, // a question isn't a marketing opt-in
    occasion: product?.name || "",
    occasionDate: body.eventDate || "",
    nowISO,
  });

  await repo.write(store);

  return NextResponse.json({
    message: "Thanks — your message is on its way to Jade & Nicole. We’ll be in touch soon.",
  });
}

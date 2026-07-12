import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import { sameOrigin } from "@/lib/security";
import { sanitizeStoreForClient } from "@/lib/adminStore";
import { normContact } from "@/lib/crm";

export const dynamic = "force-dynamic";

// GDPR erasure: permanently delete the contact and strip their personal data
// from any linked orders (name/phone/postcode/address blanked), while keeping the
// anonymised order for financial/HMRC records.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  const { id } = await ctx.params;
  const repo = getRepository();
  const store = await repo.read();
  const contact = (store.contacts || []).find((c) => c.id === id);
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const keys = [normContact(contact.email), normContact(contact.phone)].filter(Boolean);
  for (const o of store.orders || []) {
    if (keys.includes(normContact(o.phone))) {
      o.customer = "[deleted]";
      o.phone = "";
      o.postcode = "";
      o.address = "";
    }
  }
  // Scrub the person's PII from any contact-form enquiries too (kept anonymised
  // for records, like orders).
  for (const e of store.enquiries || []) {
    if (keys.includes(normContact(e.email)) || (e.phone && keys.includes(normContact(e.phone)))) {
      e.name = "[deleted]";
      e.email = "";
      e.phone = "";
      e.message = "[removed]";
    }
  }
  store.contacts = (store.contacts || []).filter((c) => c.id !== id);

  await repo.write(store); // persists anonymised orders + remaining contacts
  await repo.deleteContact(id); // purge the contact row (Postgres)

  const fresh = await repo.read();
  return NextResponse.json({ ok: true, store: sanitizeStoreForClient(fresh) });
}

import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import { sameOrigin } from "@/lib/security";
import { uid } from "@/lib/ids";

export const dynamic = "force-dynamic";

// Return (creating on first use) the secret iCal feed token + subscribe URL.
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  const repo = getRepository();
  const store = await repo.read();
  if (!store.settings.calendarToken) {
    store.settings.calendarToken = uid("cal") + uid("");
    await repo.write(store);
  }
  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
  return NextResponse.json({
    token: store.settings.calendarToken,
    url: `${base}/api/calendar/${store.settings.calendarToken}`,
  });
}

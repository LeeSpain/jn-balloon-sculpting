import { getRepository } from "@/lib/store";
import { toICS } from "@/lib/calendar";

export const dynamic = "force-dynamic";

// Secret iCal feed so Jade & Nicole can subscribe from their phone calendars.
// The token is a non-guessable secret set in admin (Calendar → Subscribe).
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const store = await getRepository().read();
  const real = store.settings.calendarToken;
  if (!real || token !== real) {
    return new Response("Not found", { status: 404 });
  }
  const ics = toICS(store, new Date().toISOString().slice(0, 10));
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="jn-balloon-sculpting.ics"',
      "cache-control": "no-store",
    },
  });
}

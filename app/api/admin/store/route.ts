import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import type { Store } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await getRepository().read();
  return NextResponse.json({ store });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let store: Store;
  try {
    ({ store } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!store || !store.settings || !Array.isArray(store.products)) {
    return NextResponse.json({ error: "Malformed store." }, { status: 400 });
  }
  await getRepository().write(store);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await getRepository().reset();
  return NextResponse.json({ store });
}

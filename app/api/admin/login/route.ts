import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createSessionToken, verifyPassword, SESSION_MAX_AGE } from "@/lib/adminAuth";
import { sameOrigin, rateLimit, clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }
  // Throttle password guessing: 10 attempts / 5 min per IP.
  if (!rateLimit(`login:${clientIp(req)}`, 10, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — try again shortly." }, { status: 429 });
  }

  let password = "";
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

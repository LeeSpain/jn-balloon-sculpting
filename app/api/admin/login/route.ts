import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createSessionToken, SESSION_MAX_AGE } from "@/lib/adminAuth";
import { verifyPassword } from "@/lib/password";
import { sameOrigin, clientIp } from "@/lib/security";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }
  // Throttle password guessing: 10 attempts / 5 min per IP (durable when a DB is
  // connected, so it holds across serverless instances).
  if (!(await checkRateLimit(`login:${clientIp(req)}`, 10, LOGIN_WINDOW_MS))) {
    const minutes = Math.ceil(LOGIN_WINDOW_MS / 60000);
    return NextResponse.json(
      {
        error: `Too many attempts. Please wait about ${minutes} minutes and try again.`,
        retryAfterMinutes: minutes,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(LOGIN_WINDOW_MS / 1000)) } },
    );
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

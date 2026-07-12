import { NextResponse } from 'next/server';
import {
  verifyCredentials, createSession, tooManyAttempts, recordAttempt, clearAttempts,
  SESSION_COOKIE, SESSION_MAX_AGE,
} from '@/lib/auth';
import { clientIp } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (await tooManyAttempts(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  let username = '';
  let password = '';
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    username = (body.username || '').trim();
    password = body.password || '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  await recordAttempt(ip);
  const ok = await verifyCredentials(username, password);
  if (!ok) {
    return NextResponse.json({ error: 'Incorrect username or password.' }, { status: 401 });
  }

  await clearAttempts(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSession(username), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

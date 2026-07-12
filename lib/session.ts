// Server-side session helpers for App Router (server components + route handlers).

import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from './auth';

export async function getSession(): Promise<{ username: string } | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

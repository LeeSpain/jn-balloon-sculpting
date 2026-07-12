// Admin authentication: scrypt password hashing, HMAC-signed session cookies, and
// DB-backed login rate limiting. Single shared founder login to start.

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { getSql, type Sql } from './db/index';
import { init } from './db/store';

export const SESSION_COOKIE = 'jn_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const RATE_WINDOW_MS = 1000 * 60 * 15; // 15 minutes
const RATE_MAX = 10; // attempts per window per IP

function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set (>=16 chars) in production.');
  }
  return 'dev-insecure-secret-change-me'; // local only
}

// ---- password hashing ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Seed a founder account on first run. Credentials come from env; a documented
// default is used only outside production so local dev works out of the box.
export async function ensureAdminUser(): Promise<void> {
  await init();
  const sql = await getSql();
  const rows = await sql.query<{ c: string }>('SELECT COUNT(*)::int AS c FROM admin_users');
  if (Number(rows[0]?.c) > 0) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'balloons');
  if (!password) throw new Error('ADMIN_PASSWORD must be set in production for first-run seeding.');
  await sql.query('INSERT INTO admin_users (username, pass_hash) VALUES ($1, $2)', [username, hashPassword(password)]);
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  await ensureAdminUser();
  const sql = await getSql();
  const rows = await sql.query<{ pass_hash: string }>('SELECT pass_hash FROM admin_users WHERE username = $1', [username]);
  if (!rows.length) return false;
  return verifyPassword(password, rows[0].pass_hash);
}

// ---- rate limiting ----

export async function tooManyAttempts(ip: string): Promise<boolean> {
  const sql = await getSql();
  await sql.query(`DELETE FROM login_attempts WHERE at < NOW() - INTERVAL '1 hour'`);
  const rows = await sql.query<{ c: string }>(
    `SELECT COUNT(*)::int AS c FROM login_attempts WHERE ip = $1 AND at > NOW() - ($2 || ' milliseconds')::interval`,
    [ip, String(RATE_WINDOW_MS)]
  );
  return Number(rows[0]?.c) >= RATE_MAX;
}

export async function recordAttempt(ip: string): Promise<void> {
  const sql = await getSql();
  await sql.query('INSERT INTO login_attempts (ip) VALUES ($1)', [ip]);
}

export async function clearAttempts(ip: string): Promise<void> {
  const sql: Sql = await getSql();
  await sql.query('DELETE FROM login_attempts WHERE ip = $1', [ip]);
}

// ---- session tokens ----

const b64url = (b: Buffer): string => b.toString('base64url');

export function createSession(username: string): string {
  const payload = { u: username, exp: Date.now() + SESSION_TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', authSecret()).update(body).digest());
  return `v1.${body}.${sig}`;
}

export function verifySession(token: string | undefined): { username: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, body, sig] = parts;
  const expected = b64url(createHmac('sha256', authSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as { u: string; exp: number };
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return { username: payload.u };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_TTL_MS / 1000;

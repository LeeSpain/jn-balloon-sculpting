// Admin auth: a shared password (ADMIN_PASSWORD) is exchanged for a signed,
// expiring session cookie.
//
// The cookie is an HMAC-signed token `"<expiry>.<sig>"` — NOT a static hash of
// the password. It expires, and because the signing secret is derived from the
// password (unless SESSION_SECRET is set), changing the password invalidates
// every existing session. Works on both the edge (middleware) and node runtimes
// via Web Crypto.
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "jn_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// Fail closed: never let a deploy run on the documented default in production.
export function adminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw && pw.length > 0) return pw;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD is not set — refusing to run with a default in production.");
  }
  return "change-me"; // dev-only convenience
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || `jn-session::${adminPassword()}`;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return b64url(new Uint8Array(sig));
}

// Length-independent constant-time-ish string compare.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyPassword(pw: string): Promise<boolean> {
  return safeEqual(pw || "", adminPassword());
}

/** Mint a fresh signed session token that expires in SESSION_TTL_MS. */
export async function createSessionToken(): Promise<string> {
  const payload = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmac(sessionSecret(), payload);
  return `${payload}.${sig}`;
}

/** True only for an unexpired token with a valid signature. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmac(sessionSecret(), payload);
  return safeEqual(sig, expected);
}

export const SESSION_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);

/** Server-side check for route handlers / server components (node runtime). */
export async function isAuthed(): Promise<boolean> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token);
}

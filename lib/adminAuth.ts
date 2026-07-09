// Lightweight admin auth: a shared password (ADMIN_PASSWORD env) is exchanged
// for an httpOnly cookie holding a SHA-256 token. Good enough until a real
// auth provider (e.g. Supabase Auth) is wired in with the database.
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "jn_admin";

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function expectedToken(): Promise<string> {
  const pw = process.env.ADMIN_PASSWORD || "change-me";
  return sha256Hex("jn-admin::" + pw);
}

export async function verifyPassword(pw: string): Promise<boolean> {
  return (pw || "") === (process.env.ADMIN_PASSWORD || "change-me");
}

/** Server-side check for route handlers / server components (node runtime). */
export async function isAuthed(): Promise<boolean> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return token === (await expectedToken());
}

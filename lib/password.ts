// Admin password verification using scrypt (node runtime only — NOT imported by
// middleware, which must stay edge/Web-Crypto only).
//
// Two supported modes, in priority order:
//   1. ADMIN_PASSWORD_HASH — a scrypt hash string (recommended for production, so
//      the plaintext password is never stored anywhere). Generate one with
//      `npm run hash-password -- 'your password'`.
//   2. ADMIN_PASSWORD — plaintext env fallback. Even here we hash it once per boot
//      (random salt) and verify submissions with scrypt + timingSafeEqual, so
//      there is no plaintext string comparison and no early-exit timing leak.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** Produce a `scrypt$N$r$p$salt$hash` string for ADMIN_PASSWORD_HASH. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${dk.toString("hex")}`;
}

function verifyHash(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const dk = scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

// Cache the hash of the plaintext env password so we don't re-derive a salt on
// every request in ADMIN_PASSWORD mode.
let plaintextHashCache: string | null = null;

export async function verifyPassword(password: string): Promise<boolean> {
  const submitted = password || "";

  const hashEnv = process.env.ADMIN_PASSWORD_HASH;
  if (hashEnv && hashEnv.length > 0) return verifyHash(submitted, hashEnv);

  const plain = process.env.ADMIN_PASSWORD;
  if (plain && plain.length > 0) {
    if (!plaintextHashCache) plaintextHashCache = hashPassword(plain);
    return verifyHash(submitted, plaintextHashCache);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Set ADMIN_PASSWORD_HASH (recommended) or ADMIN_PASSWORD — refusing to run without an admin credential in production.");
  }
  // Dev-only convenience credential.
  if (!plaintextHashCache) plaintextHashCache = hashPassword("change-me");
  return verifyHash(submitted, plaintextHashCache);
}

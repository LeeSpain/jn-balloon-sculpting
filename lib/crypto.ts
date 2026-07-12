// Symmetric encryption for secrets stored at rest in Postgres (Stripe secret key,
// webhook signing secret). AES-256-GCM (authenticated). The key comes from
// ENCRYPTION_KEY (32 bytes, hex or base64) if set, otherwise it is derived from
// SESSION_SECRET so no extra config is required in the existing deployment.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const explicit = process.env.ENCRYPTION_KEY;
  if (explicit) {
    const buf = /^[0-9a-fA-F]{64}$/.test(explicit)
      ? Buffer.from(explicit, "hex")
      : Buffer.from(explicit, "base64");
    if (buf.length === 32) return buf;
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).");
  }
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Set ENCRYPTION_KEY or SESSION_SECRET to encrypt secrets at rest.");
    }
    return scryptSync("dev-insecure-key", "jn-stripe-enc-v1", 32); // local dev only
  }
  return scryptSync(secret, "jn-stripe-enc-v1", 32);
}

/** Encrypt a UTF-8 secret. Returns "" for empty input. */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Decrypt a value produced by encryptSecret. A non-encrypted value (e.g. a
 * legacy plaintext migrated in) is returned unchanged so nothing breaks. */
export function decryptSecret(blob: string): string {
  if (!blob) return "";
  if (!blob.startsWith(PREFIX)) return blob;
  try {
    const [, , ivB, tagB, dataB] = blob.split(":");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return ""; // wrong key / corrupt — fail closed
  }
}

export function isEncrypted(blob: string): boolean {
  return !!blob && blob.startsWith(PREFIX);
}

export function last4(secret: string): string {
  return secret && secret.length >= 4 ? secret.slice(-4) : "";
}

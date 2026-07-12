// Generate a scrypt hash for ADMIN_PASSWORD_HASH.
// Usage: npm run hash-password -- 'your strong password'
import { scryptSync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run hash-password -- 'your strong password'");
  process.exit(1);
}

const N = 16384;
const R = 8;
const P = 1;
const salt = randomBytes(16);
const dk = scryptSync(password, salt, 64, { N, r: R, p: P });
const hash = `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${dk.toString("hex")}`;

console.log("\nAdd this to your environment (Vercel → Settings → Environment Variables):\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);

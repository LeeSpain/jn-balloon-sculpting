// Lightweight request-security helpers for API routes: an Origin/Referer check
// (CSRF defence-in-depth on top of the SameSite cookie) and a best-effort
// in-memory rate limiter.
//
// NOTE: the rate limiter is per-server-instance and resets on cold start, so on
// serverless it is a speed bump, not a hard guarantee. Swap in a shared store
// (e.g. Upstash) alongside the real database for durable limits.

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      hosts.add(new URL(site).host);
    } catch {
      /* ignore malformed env */
    }
  }
  return hosts;
}

/** Reject cross-site state-changing requests. Same-origin and requests from the
 * configured site URL pass; a missing Origin/Referer (e.g. server-to-server) is
 * allowed so legitimate non-browser callers aren't blocked. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const selfHost = (() => {
    try {
      return new URL(req.url).host;
    } catch {
      return "";
    }
  })();
  if (originHost === selfHost) return true;
  return allowedHosts().has(originHost);
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the caller is within the limit; false if throttled. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

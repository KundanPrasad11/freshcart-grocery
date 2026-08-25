import { logInfo } from "@/lib/logger";

type Limit = { count: number; resetAt: number };
const buckets = new Map<string, Limit>();

/** In-memory limiter for one Node instance. Use Redis/Upstash when horizontally scaling. */
export function rateLimit(request: Request, scope: string, max = 8, windowMs = 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${scope}:${forwarded ?? "unknown"}`;
  const now = Date.now();
  const current = buckets.get(key);
  const limit = !current || current.resetAt < now ? { count: 0, resetAt: now + windowMs } : current;
  limit.count += 1;
  buckets.set(key, limit);
  if (limit.count <= max) return null;
  const retryAfter = Math.max(1, Math.ceil((limit.resetAt - now) / 1000));
  logInfo("security.rate_limited", { scope, retryAfter });
  return Response.json(
    { error: "Too many attempts. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export function resetRateLimitsForTests() {
  buckets.clear();
}

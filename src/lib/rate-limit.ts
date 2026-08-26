import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { hashIdentifier, logInfo } from "@/lib/logger";

export type RateLimitPolicy = { scope: string; max: number; windowMs: number };
export type RateLimitResult = { success: boolean; retryAfter: number; remaining: number };

export const LOGIN_RATE_LIMIT: RateLimitPolicy = {
  scope: "auth.login",
  max: 10,
  windowMs: 15 * 60_000,
};
export const REGISTRATION_RATE_LIMIT: RateLimitPolicy = {
  scope: "auth.register",
  max: 5,
  windowMs: 15 * 60_000,
};
export const INVOICE_RATE_LIMIT: RateLimitPolicy = {
  scope: "invoice.send",
  max: 3,
  windowMs: 15 * 60_000,
};

type Bucket = { count: number; resetAt: number };
const localBuckets = new Map<string, Bucket>();
const remoteLimiters = new Map<string, Ratelimit>();

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function rateLimitIdentity(request: Request, identity = "") {
  return hashIdentifier(`${clientIp(request)}:${identity.trim().toLowerCase()}`);
}

function remoteLimiter(policy: RateLimitPolicy) {
  // Tests need isolated, deterministic counters; production and preview
  // deployments continue to use the shared Upstash adapter when configured.
  if (process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST === "1") return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const cacheKey = `${policy.scope}:${policy.max}:${policy.windowMs}`;
  const existing = remoteLimiters.get(cacheKey);
  if (existing) return existing;
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(policy.max, `${Math.ceil(policy.windowMs / 1000)} s`),
    analytics: false,
    prefix: "freshcart:rate-limit",
  });
  remoteLimiters.set(cacheKey, limiter);
  return limiter;
}

function localLimit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  const bucket = localBuckets.get(key);
  const current =
    !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + policy.windowMs } : bucket;
  current.count += 1;
  localBuckets.set(key, current);
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return {
    success: current.count <= policy.max,
    retryAfter,
    remaining: Math.max(0, policy.max - current.count),
  };
}

export async function rateLimit(
  request: Request,
  policy: RateLimitPolicy,
  identity = ""
): Promise<RateLimitResult> {
  const key = `${policy.scope}:${rateLimitIdentity(request, identity)}`;
  const distributed = remoteLimiter(policy);
  const result = distributed
    ? await distributed.limit(key).then((limit) => ({
        success: limit.success,
        retryAfter: Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)),
        remaining: limit.remaining,
      }))
    : localLimit(key, policy);
  if (!result.success)
    logInfo("security.rate_limited", {
      scope: policy.scope,
      retryAfter: result.retryAfter,
      key: hashIdentifier(key),
    });
  return result;
}

export function resetRateLimitsForTests() {
  localBuckets.clear();
  remoteLimiters.clear();
}

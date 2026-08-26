import { afterEach, describe, expect, it } from "vitest";
import {
  RateLimitPolicy,
  rateLimit,
  rateLimitIdentity,
  resetRateLimitsForTests,
} from "@/lib/rate-limit";

describe("rateLimit", () => {
  afterEach(resetRateLimitsForTests);

  it("limits a privacy-safe client identity after the configured limit", async () => {
    const request = new Request("http://test/login", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    });
    const policy: RateLimitPolicy = { scope: "login-test", max: 1, windowMs: 60_000 };
    expect((await rateLimit(request, policy, "jamie@example.test")).success).toBe(true);
    const limited = await rateLimit(request, policy, "jamie@example.test");
    expect(limited).toMatchObject({ success: false, retryAfter: 60, remaining: 0 });
    expect(rateLimitIdentity(request, "jamie@example.test")).not.toContain("jamie@example.test");
  });
});

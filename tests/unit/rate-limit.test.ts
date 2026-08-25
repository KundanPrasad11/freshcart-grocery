import { afterEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimitsForTests } from "@/lib/rate-limit";

describe("rateLimit", () => {
  afterEach(resetRateLimitsForTests);

  it("returns 429 with a retry hint after the configured limit", async () => {
    const request = new Request("http://test/login", { headers: { "x-forwarded-for": "198.51.100.10" } });
    expect(rateLimit(request, "login", 1, 60_000)).toBeNull();
    const limited = rateLimit(request, "login", 1, 60_000);
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBe("60");
    await expect(limited?.json()).resolves.toMatchObject({ error: expect.stringContaining("Too many") });
  });
});

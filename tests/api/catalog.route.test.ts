import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/catalog/route";
import { closeApiState, resetApiState } from "../support/api-test";
import { configureTestEnvironment } from "../support/test-environment";

describe("GET /api/catalog", () => {
  beforeAll(configureTestEnvironment);
  beforeEach(resetApiState);
  afterAll(closeApiState);

  it("returns the seeded public catalog with cache headers", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=60");
    const body = await response.json();
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.products[0]).not.toHaveProperty("stockQuantity");
  });
});
